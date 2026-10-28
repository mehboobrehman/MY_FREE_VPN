import 'dart:convert';
import 'package:cryptography/cryptography.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:my_free_vpn/services/vpn_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('VpnService has static fallback node URL constant', () {
    expect(VpnService.defaultFallbackNodeUrl, '195.201.0.1:51820');
  });

  test('Ed25519 signing generates valid keypair and signature for device', () async {
    final algorithm = Ed25519();
    final keyPair = await algorithm.newKeyPair();
    final publicKeyObj = await keyPair.extractPublicKey();

    final deviceUuid = 'test-device-uuid-12345';
    final messageBytes = utf8.encode(deviceUuid);
    final signatureObj = await algorithm.sign(messageBytes, keyPair: keyPair);

    expect(publicKeyObj.bytes.length, 32);
    expect(signatureObj.bytes.length, 64);

    final isValid = await algorithm.verify(
      messageBytes,
      signature: Signature(
        signatureObj.bytes,
        publicKey: publicKeyObj,
      ),
    );
    expect(isValid, isTrue);
  });

  test('Parsing endpoint_ip and endpoint_port from backend node format', () {
    final backendNodeResponse = {
      'nodes': [
        {
          'node_id': 'test-node-1',
          'endpoint_ip': '195.201.0.1',
          'endpoint_port': 51820,
          'country_code': 'SG',
        }
      ]
    };

    final node = backendNodeResponse['nodes']![0];
    final nodeIp = (node['endpoint_ip'] ?? node['ip'])?.toString();
    final rawPort = node['endpoint_port'] ?? node['port'];
    final nodePort = rawPort is int ? rawPort : int.tryParse(rawPort?.toString() ?? '');

    expect(nodeIp, '195.201.0.1');
    expect(nodePort, 51820);
    expect('$nodeIp:$nodePort', '195.201.0.1:51820');
  });
}
