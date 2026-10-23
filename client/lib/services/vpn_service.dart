import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:uuid/uuid.dart';
import 'package:encrypt/encrypt.dart' as encrypt;
import 'package:pointycastle/api.dart' as pointycastle;
import 'package:flutter_udid/flutter_udid.dart';
import 'package:logger/logger.dart';

import 'windows_vpn_service.dart';

/// Cross-platform VPN service abstraction.
///
/// Android connects through the system [VpnService] via a platform channel.
/// Windows connects through the No-Admin proxy bound in [WindowsVpnService]
/// (Dart FFI into the native helper).
class VpnService {
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
      // 1. Get or generate Device UUID and cryptographic keypair
      final String deviceId = await _getOrGenerateDeviceId();
      final String publicKey = await _getOrGeneratePublicKey(deviceId);
      _logger.d('Device ID: $deviceId, Public Key: $publicKey');

      // 2. Register with backend and obtain an exit node
      final String? serverNodeUrl =
          await _registerDeviceAndGetNode(deviceId, publicKey);
      if (serverNodeUrl == null) {
        throw Exception('Failed to get a valid server node URL from backend.');
      }
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
        deviceId = await FlutterUdid.consistentIdentity;
      } catch (e) {
        _logger.w('Could not get device UDID, generating random UUID. Error: $e');
        deviceId = const Uuid().v4();
      }
      await prefs.setString('_deviceId', deviceId);
    }
    return deviceId;
  }

  static Future<String> _getOrGeneratePublicKey(String deviceId) async {
    final prefs = await SharedPreferences.getInstance();
    String? publicKey = prefs.getString('_publicKey');
    if (publicKey == null) {
      // Generate a new EC key pair (placeholder for WireGuard Curve25519 keys)
      final params = pointycastle.ECKeyGeneratorParameters(
          pointycastle.ECDomainParameters('prime256v1'));
      final generator = pointycastle.ECKeyGenerator();
      generator.init(params);
      final keyPair = generator.generateKeyPair();

      final publicKeyPoint = keyPair.publicKey as pointycastle.ECPublicKey;

      final publicKeyBytes =
          pointycastle.Uint8List.fromList(publicKeyPoint.Q!.getEncoded(false));
      publicKey = encrypt.Encrypted(publicKeyBytes).base64;

      // Store the public key.
      await prefs.setString('_publicKey', publicKey);
      _logger.i('Generated new public key.');
    }
    return publicKey;
  }

  static Future<String?> _registerDeviceAndGetNode(
      String deviceId, String publicKey) async {
    final prefs = await SharedPreferences.getInstance();
    String? cachedNodeUrl = prefs.getString('_cachedNodeUrl');
    if (cachedNodeUrl != null) {
      return cachedNodeUrl;
    }

    final String registerUrl =
        'http://127.0.0.1:8080/api/v1/auth/register';
    final String nodesUrl = 'http://127.0.0.1:8080/api/v1/nodes';

    try {
      final registerResponse = await http.post(
        Uri.parse(registerUrl),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'deviceId': deviceId,
          'publicKey': publicKey,
        }),
      );

      if (registerResponse.statusCode != 200) {
        _logger.e(
            'Device registration failed: ${registerResponse.statusCode} - ${registerResponse.body}');
        return null;
      }

      final registerBody = jsonDecode(registerResponse.body);
      final String? authToken = registerBody['token'];
      if (authToken == null) {
        _logger.e('Registration response missing auth token.');
        return null;
      }

      final nodesResponse = await http.get(
        Uri.parse(nodesUrl),
        headers: {'Authorization': 'Bearer $authToken'},
      );

      if (nodesResponse.statusCode != 200) {
        _logger.e('Failed to fetch nodes: ${nodesResponse.statusCode} - ${nodesResponse.body}');
        return null;
      }

      final nodesData = jsonDecode(nodesResponse.body);
      if (nodesData != null && nodesData is List && nodesData.isNotEmpty) {
        final node = nodesData[0];
        final String? nodeIp = node['ip'];
        final int? nodePort = node['port'];

        if (nodeIp != null && nodePort != null) {
          final String nodeUrl = '$nodeIp:$nodePort';
          await prefs.setString('_cachedNodeUrl', nodeUrl);
          return nodeUrl;
        } else {
          _logger.e('Node data missing IP or port.');
          return null;
        }
      } else {
        _logger.e('No nodes available or invalid node data format.');
        return null;
      }
    } catch (e) {
      _logger.e('Error during device registration or node fetching: $e');
      return null;
    }
  }
}
