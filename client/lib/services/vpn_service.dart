import 'dart:convert';
import 'dart:io';

import 'package:cryptography/cryptography.dart';
import 'package:flutter/services.dart';
import 'package:flutter_udid/flutter_udid.dart';
import 'package:http/http.dart' as http;
import 'package:logger/logger.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';

import 'windows_vpn_service.dart';

/// Cross-platform VPN service abstraction.
///
/// Android connects through the system [VpnService] via a platform channel.
/// Windows connects through the No-Admin proxy bound in [WindowsVpnService]
/// (Dart FFI into the native helper).
class VpnService {
  /// Default static fallback exit node for zero-setup operation when offline/unreachable.
  static const String defaultFallbackNodeUrl = '195.201.0.1:51820';

  /// Base URL for the backend API.
  static const String _apiBaseUrl = 'http://127.0.0.1:8080/api/v1';

  /// Platform channel shared with the Android host (MainActivity).
  static const MethodChannel _channel =
      MethodChannel('com.myfreevpn.app/vpn');
  static final Logger _logger = Logger();

  /// Establish a VPN tunnel on the current platform.
  ///
  /// Registers the device with the backend, obtains an exit node, then hands
  /// off to the platform-specific connector.
  static Future<void> connect() async {
    _logger.i('Initiating VPN connection...');

    try {
      // 1. Get or generate Device UUID and cryptographic keypair / signature
      final String deviceId = await _getOrGenerateDeviceId();
      final Map<String, String> keyInfo = await _getOrGenerateCryptoKeys(deviceId);
      final String publicKey = keyInfo['publicKey']!;
      final String signature = keyInfo['signature']!;
      _logger.d('Device ID: $deviceId, Public Key: $publicKey');

      // 2. Register with backend and obtain an exit node (returns fallback node if offline/failed)
      final String serverNodeUrl =
          await _registerDeviceAndGetNode(deviceId, publicKey, signature);
      _logger.d('Obtained server node URL: $serverNodeUrl');

      // 3. Platform-specific connection
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

    const String registerUrl = '$_apiBaseUrl/auth/register';
    const String nodesUrl = '$_apiBaseUrl/nodes';

    try {
      final String platform = Platform.isAndroid
          ? 'android'
          : (Platform.isWindows ? 'windows' : 'android');

      _logger.d('Registering device with backend: $registerUrl');
      final registerResponse = await http.post(
        Uri.parse(registerUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'device_uuid': deviceId,
          'public_key': publicKey,
          'signature': signature,
          'platform': platform,
          'app_version': '1.0.0',
        }),
      ).timeout(const Duration(seconds: 10));

      if (registerResponse.statusCode != 200) {
        _logger.e(
            'Device registration failed: ${registerResponse.statusCode} - ${registerResponse.body}');
        _logger.w('Falling back to default server node: $defaultFallbackNodeUrl');
        return defaultFallbackNodeUrl;
      }

      _logger.d('Device registered successfully. Fetching server nodes: $nodesUrl');
      final nodesResponse = await http.get(
        Uri.parse(nodesUrl),
      ).timeout(const Duration(seconds: 10));

      if (nodesResponse.statusCode != 200) {
        _logger.e(
            'Failed to fetch nodes: ${nodesResponse.statusCode} - ${nodesResponse.body}');
        _logger.w('Falling back to default server node: $defaultFallbackNodeUrl');
        return defaultFallbackNodeUrl;
      }

      final nodesData = jsonDecode(nodesResponse.body);
      List? nodeList;
      if (nodesData is List) {
        nodeList = nodesData;
      } else if (nodesData is Map && nodesData['nodes'] is List) {
        nodeList = nodesData['nodes'] as List;
      }

      if (nodeList != null && nodeList.isNotEmpty) {
        for (final node in nodeList) {
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
        _logger.e('Node data missing endpoint IP or port.');
      } else {
        _logger.e('No nodes available or invalid node data format.');
      }
    } catch (e) {
      _logger.e('Error during device registration or node fetching: $e');
    }

    _logger.w('Using static default fallback server node: $defaultFallbackNodeUrl');
    return defaultFallbackNodeUrl;
  }
}
