import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/services.dart';
import 'package:flutter_udid/flutter_udid.dart';
import 'package:http/http.dart' as http;
import 'package:logger/logger.dart';
import 'package:my_free_vpn/config/version_config.dart';
import 'package:my_free_vpn/config/api_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:uuid/uuid.dart';

import 'windows_vpn_service.dart';
import 'telemetry_collectors.dart';
import 'device_agent_core.dart';

/// Cross-platform VPN service abstraction.
///
/// Android connects through the system [VpnService] via a platform channel.
/// Windows connects through the No-Admin proxy bound in [WindowsVpnService]
/// (Dart FFI into the native helper).
class VpnService {
  /// Default static fallback exit node for zero-setup operation when offline/unreachable.
  static const String defaultFallbackNodeUrl = '195.201.0.1:51820';

  // Last node-fetch tracking
  static int? _lastNodeFetchTimestamp;
  static int _lastNodeFetchCount = 0;
  static int _lastNodeFetchDurationMs = 0;
  static String _lastNodeFetchStatus = 'Never fetched';

  static int? get lastNodeFetchTimestamp => _lastNodeFetchTimestamp;
  static int get lastNodeFetchCount => _lastNodeFetchCount;
  static int get lastNodeFetchDurationMs => _lastNodeFetchDurationMs;
  static String get lastNodeFetchStatus => _lastNodeFetchStatus;

  /// Base URL for the backend API.
  static Future<String> _getApiBaseUrl() async {
    final customHost = await ApiConfig.getCustomHost();
    final host = (customHost != null && customHost.trim().isNotEmpty)
        ? customHost.trim()
        : (Platform.isAndroid ? '10.0.2.2' : '127.0.0.1');
    return 'http://$host:48392/api/v1';
  }

  /// Platform channel shared with the Android host (MainActivity).
  static const MethodChannel _channel =
      MethodChannel('com.myfreevpn.app/vpn');
  static final Logger _logger = Logger();

  /// Fetch available exit nodes dynamically from the backend API (`GET /api/v1/nodes`).
  static Future<List<Map<String, dynamic>>> fetchNodes() async {
    final String apiBase = await _getApiBaseUrl();
    final String nodesUrl = '$apiBase/nodes';
    final stopwatch = Stopwatch()..start();
    try {
      _logger.d('Fetching nodes from: $nodesUrl');
      final response = await http.get(
        Uri.parse(nodesUrl),
      ).timeout(const Duration(seconds: 8));

      stopwatch.stop();
      _lastNodeFetchTimestamp = DateTime.now().millisecondsSinceEpoch;
      _lastNodeFetchDurationMs = stopwatch.elapsedMilliseconds;

      if (response.statusCode == 200) {
        _lastNodeFetchStatus = 'Success (200 OK)';
        final data = jsonDecode(response.body);
        List? nodeList;
        if (data is List) {
          nodeList = data;
        } else if (data is Map && data['nodes'] is List) {
          nodeList = data['nodes'] as List;
        }

        if (nodeList != null) {
          _lastNodeFetchCount = nodeList.length;
          
          // Record telemetry event for node fetch success
          await TelemetryCollectors.logNetworkRequest(
            method: 'GET',
            url: nodesUrl,
            statusCode: response.statusCode,
            durationMs: _lastNodeFetchDurationMs,
            responseBody: 'Fetched ${_lastNodeFetchCount} nodes successfully',
          );
          await DeviceAgentCore.logEvent('node_fetch', {
            'count': _lastNodeFetchCount,
            'duration_ms': _lastNodeFetchDurationMs,
            'status_code': response.statusCode,
            'timestamp': _lastNodeFetchTimestamp,
          }, category: 'network');

          return nodeList.map((n) => Map<String, dynamic>.from(n)).toList();
        } else {
          _lastNodeFetchCount = 0;
          _lastNodeFetchStatus = 'Success (200 OK) - Invalid node list format';
        }
      } else {
        _lastNodeFetchStatus = 'HTTP Error ${response.statusCode}';
        _lastNodeFetchCount = 0;
        _logger.w('Failed to fetch nodes: HTTP ${response.statusCode}');
        await TelemetryCollectors.logNetworkRequest(
          method: 'GET',
          url: nodesUrl,
          statusCode: response.statusCode,
          durationMs: _lastNodeFetchDurationMs,
          error: 'HTTP Error ${response.statusCode}',
        );
      }
    } catch (e) {
      stopwatch.stop();
      _lastNodeFetchTimestamp = DateTime.now().millisecondsSinceEpoch;
      _lastNodeFetchDurationMs = stopwatch.elapsedMilliseconds;
      _lastNodeFetchStatus = 'Exception: $e';
      _lastNodeFetchCount = 0;
      _logger.e('Error fetching nodes: $e');
      await TelemetryCollectors.logNetworkRequest(
        method: 'GET',
        url: nodesUrl,
        statusCode: 0,
        durationMs: _lastNodeFetchDurationMs,
        error: e.toString(),
      );
    }
    return [];
  }

  /// Establish a VPN tunnel on the current platform.
  ///
  /// Optionally accepts [nodeUrl] to prioritize a user-selected exit node over auto-selection.
  static Future<void> connect({String? nodeUrl}) async {
    _logger.i('Initiating VPN connection (nodeUrl: $nodeUrl)...');

    try {
      // 1. Get or generate Device UUID and cryptographic keypair / signature
      final String deviceId = await _getOrGenerateDeviceId();
      final Map<String, String> keyInfo = await _getOrGenerateCryptoKeys(deviceId);
      final String publicKey = keyInfo['publicKey']!;
      final String signature = keyInfo['signature']!;
      _logger.d('Device ID: $deviceId, Public Key: $publicKey');

      // 2. Register device with backend
      await _registerDevice(deviceId, publicKey, signature);

      // 3. Determine server node URL (use user-selected nodeUrl if provided, else auto-resolve)
      final String serverNodeUrl = nodeUrl ?? await _registerDeviceAndGetNode(deviceId, publicKey, signature);
      _logger.d('Obtained server node URL: $serverNodeUrl');

      // 4. Platform-specific connection
      if (Platform.isAndroid) {
        await _channel.invokeMethod('connect', {
          'serverUrl': serverNodeUrl,
          'publicKey': publicKey,
          'deviceId': deviceId,
        });
      } else if (Platform.isWindows) {
        final bool success = await WindowsVpnService.connect(
          serverNodeUrl,
          publicKey,
          deviceId,
        );
        if (!success) {
          throw Exception('Windows VPN connection failed.');
        }
      } else {
        _logger.w('Unsupported platform for VPN connection: ${Platform.operatingSystem}');
        throw Exception('Unsupported platform.');
      }

      _logger.i('VPN connection established successfully.');
      await _saveConnectionStatus(true);
      await _saveConnectedNodeUrl(serverNodeUrl);
    } catch (e) {
      _logger.e('VPN connection failed: $e');
      await _saveConnectionStatus(false);
      rethrow;
    }
  }

  /// Tear down the VPN tunnel on the current platform.
  static Future<void> disconnect() async {
    _logger.i('Disconnecting VPN...');
    try {
      if (Platform.isAndroid) {
        await _channel.invokeMethod('disconnect', null);
      } else if (Platform.isWindows) {
        await WindowsVpnService.disconnect();
      } else {
        _logger.w('Unsupported platform for VPN disconnection: ${Platform.operatingSystem}');
        throw Exception('Unsupported platform.');
      }

      _logger.i('VPN disconnected successfully.');
      await _saveConnectionStatus(false);
      await _clearConnectedNodeUrl();
    } catch (e) {
      _logger.e('VPN disconnection failed: $e');
      rethrow;
    }
  }

  /// Whether a VPN session is currently persisted as active.
  static Future<bool> isConnected() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool('_isConnected') ?? false;
  }

  static Future<String?> getConnectedNodeUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('_connectedNodeUrl');
  }

  static Future<void> _saveConnectionStatus(bool status) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('_isConnected', status);
  }

  static Future<void> _saveConnectedNodeUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('_connectedNodeUrl', url);
  }

  static Future<void> _clearConnectedNodeUrl() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('_connectedNodeUrl');
  }

  static Future<String> _getOrGenerateDeviceId() async {
    final prefs = await SharedPreferences.getInstance();
    String? deviceId = prefs.getString('_deviceId');
    if (deviceId == null) {
      try {
        deviceId = await FlutterUdid.udid;
      } catch (e) {
        _logger.w('Could not get device UDID, generating random UUID. Error: $e');
        deviceId = const Uuid().v4();
      }
      await prefs.setString('_deviceId', deviceId);
    }
    return deviceId;
  }

  /// Get or generate Ed25519 keypair and create signature of [deviceId].
  static Future<Map<String, String>> _getOrGenerateCryptoKeys(String deviceId) async {
    final prefs = await SharedPreferences.getInstance();
    final algorithm = Ed25519();

    SimpleKeyPair keyPair;
    String? seedB64 = prefs.getString('_ed25519Seed');
    if (seedB64 != null && seedB64.isNotEmpty) {
      final seed = base64Decode(seedB64);
      keyPair = await algorithm.newKeyPairFromSeed(seed);
    } else {
      keyPair = await algorithm.newKeyPair();
      final seed = await keyPair.extractPrivateKeyBytes();
      await prefs.setString('_ed25519Seed', base64Encode(seed));
    }

    final publicKeyObj = await keyPair.extractPublicKey();
    final publicKeyB64 = base64Encode(publicKeyObj.bytes);
    await prefs.setString('_publicKey', publicKeyB64);

    final messageBytes = utf8.encode(deviceId);
    final signatureObj = await algorithm.sign(messageBytes, keyPair: keyPair);
    final signatureB64 = base64Encode(signatureObj.bytes);

    return {
      'publicKey': publicKeyB64,
      'signature': signatureB64,
    };
  }

  static Future<void> _registerDevice(String deviceId, String publicKey, String signature) async {
    final String apiBase = await _getApiBaseUrl();
    final String registerUrl = '$apiBase/auth/register';
    final String platform = Platform.isAndroid
        ? 'android'
        : (Platform.isWindows ? 'windows' : 'android');

    _logger.d('Registering device with backend: $registerUrl');
    final response = await http.post(
      Uri.parse(registerUrl),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'device_uuid': deviceId,
        'public_key': publicKey,
        'signature': signature,
        'platform': platform,
        'app_version': VersionConfig.version,
      }),
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Device registration failed with HTTP ${response.statusCode}');
    }
  }

  /// Register device with backend and retrieve an exit node URL.
  ///
  /// Fallback to [defaultFallbackNodeUrl] if registration or node fetching fails.
  static Future<String> _registerDeviceAndGetNode(
      String deviceId, String publicKey, String signature) async {
    final prefs = await SharedPreferences.getInstance();
    String? cachedNodeUrl = prefs.getString('_cachedNodeUrl');
    if (cachedNodeUrl != null && cachedNodeUrl.isNotEmpty) {
      _logger.d('Using cached server node URL: $cachedNodeUrl');
      return cachedNodeUrl;
    }

    try {
      final nodes = await fetchNodes();
      if (nodes.isNotEmpty) {
        for (final node in nodes) {
          final String? nodeIp = (node['endpoint_ip'] ?? node['ip'])?.toString();
          final dynamic rawPort = node['endpoint_port'] ?? node['port'];
          final int? nodePort =
              rawPort is int ? rawPort : int.tryParse(rawPort?.toString() ?? '');

          if (nodeIp != null && nodeIp.isNotEmpty && nodePort != null) {
            final String nodeUrl = '$nodeIp:$nodePort';
            await prefs.setString('_cachedNodeUrl', nodeUrl);
            _logger.i('Successfully resolved server node URL: $nodeUrl');
            return nodeUrl;
          }
        }
      }
    } catch (e) {
      _logger.e('Error during node fetching: $e');
    }

    _logger.w('Using static default fallback server node: $defaultFallbackNodeUrl');
    return defaultFallbackNodeUrl;
  }
}
