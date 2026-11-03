import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:sqflite/sqflite.dart';
import 'agent_logger.dart';
import 'telemetry_redactor.dart';

enum AgentConnectionState { offline, connecting, connected, degraded }

/// Device Agent Core managing connectivity state machine, automatic endpoint discovery,
/// offline SQLite ring buffer, handshake & clock sync, batching, and debug-only gating.
class DeviceAgentCore {
  static AgentConnectionState _currentState = AgentConnectionState.offline;
  static final StreamController<AgentConnectionState> _stateController =
      StreamController<AgentConnectionState>.broadcast();

  static Timer? _syncTimer;
  static int _sequenceNumber = 0;
  static String? _discoveredEndpoint;
  static int _clockOffsetMs = 0;
  static bool _isSyncing = false;
  static int _retryAttempt = 0;

  static AgentConnectionState get currentState => _currentState;
  static Stream<AgentConnectionState> get stateStream => _stateController.stream;
  static int get clockOffsetMs => _clockOffsetMs;
  static String? get discoveredEndpoint => _discoveredEndpoint;

  static void _updateState(AgentConnectionState newState) {
    if (_currentState != newState) {
      _currentState = newState;
      if (!_stateController.isClosed) {
        _stateController.add(newState);
      }
      AgentLogger.i('DeviceAgentCore', 'State transitioned to: $newState');
    }
  }

  /// Initialize the Device Agent Core (Debug-only gated).
  static Future<void> initialize() async {
    if (!kDebugMode) return;

    AgentLogger.i('DeviceAgentCore', 'Initializing Device Agent Core...');
    _updateState(AgentConnectionState.connecting);

    await _ensureQueueTable();
    await discoverEndpoint();

    // Start periodic background sync timer (every 10 seconds)
    _syncTimer?.cancel();
    _syncTimer = Timer.periodic(const Duration(seconds: 10), (_) => _syncQueueAndHeartbeat());
  }

  static Future<void> dispose() async {
    _syncTimer?.cancel();
    if (!_stateController.isClosed) {
      await _stateController.close();
    }
  }

  static Future<void> _ensureQueueTable() async {
    try {
      final db = await AgentLogger.database;
      await db.execute('''
        CREATE TABLE IF NOT EXISTS telemetry_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          envelope TEXT NOT NULL,
          category TEXT NOT NULL,
          timestamp INTEGER NOT NULL
        )
      ''');
    } catch (e) {
      AgentLogger.e('DeviceAgentCore', 'Failed to create telemetry_queue table: $e');
    }
  }

  /// Endpoint Discovery supporting Local Wi-Fi and Cloud Relay fallback.
  static Future<String?> discoverEndpoint() async {
    if (!kDebugMode) return null;

    final localIp = Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
    final port = 48392;
    final localUrl = 'http://$localIp:$port/api/v1/telemetry/discovery';
    final cloudRelayUrl = 'https://myfreevpn-debug-relay.ngrok-free.app/api/v1/telemetry/discovery';

    // Try Local Wi-Fi first
    try {
      AgentLogger.d('DeviceAgentCore', 'Attempting discovery via Local Wi-Fi: $localUrl');
      final response = await http.get(Uri.parse(localUrl)).timeout(const Duration(seconds: 3));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final wifiEndpoint = data['discovery']?['local_wifi']?['http_endpoint'];
        if (wifiEndpoint != null) {
          _discoveredEndpoint = wifiEndpoint.toString().replaceAll('/events', '');
          _updateState(AgentConnectionState.connected);
          AgentLogger.i('DeviceAgentCore', 'Discovered Local Wi-Fi endpoint: $_discoveredEndpoint');
          return _discoveredEndpoint;
        }
      }
    } catch (e) {
      AgentLogger.w('DeviceAgentCore', 'Local Wi-Fi discovery failed: $e. Trying Cloud Relay...');
    }

    // Fallback to Cloud Relay
    try {
      final response = await http.get(Uri.parse(cloudRelayUrl)).timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final relayEndpoint = data['discovery']?['cloud_relay']?['http_endpoint'];
        if (relayEndpoint != null) {
          _discoveredEndpoint = relayEndpoint.toString().replaceAll('/events', '');
          _updateState(AgentConnectionState.degraded);
          AgentLogger.i('DeviceAgentCore', 'Discovered Cloud Relay endpoint: $_discoveredEndpoint');
          return _discoveredEndpoint;
        }
      }
    } catch (e) {
      AgentLogger.e('DeviceAgentCore', 'Cloud Relay discovery failed: $e');
    }

    _discoveredEndpoint = 'http://$localIp:$port/api/v1/telemetry';
    _updateState(AgentConnectionState.offline);
    return _discoveredEndpoint;
  }

  /// Handshake & Clock Sync estimation between device and host.
  static Future<bool> performHandshake(String deviceId, String publicKey, String signature) async {
    if (!kDebugMode) return false;

    final baseEndpoint = _discoveredEndpoint ?? (Platform.isAndroid ? 'http://10.0.2.2:48392/api/v1/telemetry' : 'http://127.0.0.1:48392/api/v1/telemetry');
    final handshakeUrl = '$baseEndpoint/events';

    final clientSendTime = DateTime.now().millisecondsSinceEpoch;
    final envelope = {
      'schema_version': '1.0.0',
      'session_id': '00000000-0000-0000-0000-000000000001',
      'device_id': deviceId,
      'sequence_number': _sequenceNumber++,
      'monotonic_timestamp': DateTime.now().millisecondsSinceEpoch.toDouble(),
      'wall_clock_timestamp': clientSendTime,
      'message_type': 'event',
      'payload': {
        'event_type': 'handshake',
        'public_key': publicKey,
        'signature': signature,
        'client_send_time': clientSendTime,
      }
    };

    try {
      final response = await http.post(
        Uri.parse(handshakeUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(envelope),
      ).timeout(const Duration(seconds: 4));
      final clientReceiveTime = DateTime.now().millisecondsSinceEpoch;

      if (response.statusCode == 201 || response.statusCode == 200) {
        final rtt = clientReceiveTime - clientSendTime;
        final responseData = jsonDecode(response.body);
        final serverTimestamp = responseData['serverTimestamp'] ?? clientReceiveTime - (rtt ~/ 2);
        _clockOffsetMs = serverTimestamp - (clientSendTime + (rtt ~/ 2));
        
        _updateState(AgentConnectionState.connected);
        AgentLogger.i('DeviceAgentCore', 'Handshake successful. RTT: ${rtt}ms, Clock Offset: ${_clockOffsetMs}ms');
        return true;
      }
    } catch (e) {
      AgentLogger.w('DeviceAgentCore', 'Handshake failed: $e');
      _updateState(AgentConnectionState.offline);
    }
    return false;
  }

  /// Log and queue a telemetry event with redaction and ring buffering.
  static Future<void> logEvent(String messageType, Map<String, dynamic> payload, {String category = 'default'}) async {
    if (!kDebugMode) return;

    final redactedPayload = TelemetryRedactor.redact(payload);
    final wallClock = DateTime.now().millisecondsSinceEpoch + _clockOffsetMs;

    final envelope = {
      'schema_version': '1.0.0',
      'session_id': '00000000-0000-0000-0000-000000000001',
      'device_id': 'local-device',
      'sequence_number': _sequenceNumber++,
      'monotonic_timestamp': DateTime.now().millisecondsSinceEpoch.toDouble(),
      'wall_clock_timestamp': wallClock,
      'message_type': messageType,
      'payload': redactedPayload,
    };

    await _bufferEvent(envelope, category);
  }

  static Future<void> _bufferEvent(Map<String, dynamic> envelope, String category) async {
    try {
      final db = await AgentLogger.database;
      
      // Bounded ring buffer: max 5000 events, prune oldest if exceeded
      final countResult = await db.rawQuery('SELECT COUNT(*) as count FROM telemetry_queue');
      final count = Sqflite.firstIntValue(countResult) ?? 0;
      if (count >= 5000) {
        await db.execute('DELETE FROM telemetry_queue WHERE id IN (SELECT id FROM telemetry_queue ORDER BY id ASC LIMIT 100)');
      }

      await db.insert('telemetry_queue', {
        'envelope': jsonEncode(envelope),
        'category': category,
        'timestamp': DateTime.now().millisecondsSinceEpoch,
      });

      if (_currentState == AgentConnectionState.connected || _currentState == AgentConnectionState.degraded) {
        _syncQueueAndHeartbeat();
      }
    } catch (e) {
      AgentLogger.e('DeviceAgentCore', 'Error buffering telemetry event: $e');
    }
  }

  /// Flush offline queue in order with batching and exponential backoff with jitter.
  static Future<void> _syncQueueAndHeartbeat() async {
    if (_isSyncing || !kDebugMode) return;
    _isSyncing = true;

    try {
      final db = await AgentLogger.database;
      final rows = await db.query('telemetry_queue', orderBy: 'id ASC', limit: 50);

      if (rows.isEmpty) {
        _isSyncing = false;
        return;
      }

      final envelopes = rows.map((r) => jsonDecode(r['envelope'] as String)).toList();
      final ids = rows.map((r) => r['id'] as int).toList();

      final baseEndpoint = _discoveredEndpoint ?? (Platform.isAndroid ? 'http://10.0.2.2:48392/api/v1/telemetry' : 'http://127.0.0.1:48392/api/v1/telemetry');
      final eventsUrl = '$baseEndpoint/events';

      final response = await http.post(
        Uri.parse(eventsUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(envelopes.length == 1 ? envelopes[0] : envelopes),
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 201 || response.statusCode == 200) {
        for (final id in ids) {
          await db.delete('telemetry_queue', where: 'id = ?', whereArgs: [id]);
        }
        _retryAttempt = 0;
        if (_currentState == AgentConnectionState.offline) {
          _updateState(AgentConnectionState.connected);
        }
      } else {
        _handleSyncFailure();
      }
    } catch (e) {
      AgentLogger.w('DeviceAgentCore', 'Sync telemetry queue error: $e');
      _handleSyncFailure();
    } finally {
      _isSyncing = false;
    }
  }

  static void _handleSyncFailure() {
    _retryAttempt++;
    _updateState(AgentConnectionState.offline);
    final delaySec = min(30.0, pow(2.0, _retryAttempt).toDouble());
    final jitter = Random().nextDouble() * 1.0;
    final backoffMs = ((delaySec + jitter) * 1000).toInt();

    Timer(Duration(milliseconds: backoffMs), () {
      discoverEndpoint();
    });
  }
}
