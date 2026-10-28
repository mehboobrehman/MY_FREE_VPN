import 'dart:convert';
import 'package:cryptography/cryptography.dart';

void main() async {
  final algorithm = Ed25519();
  final keyPair1 = await algorithm.newKeyPair();
  final seed = await keyPair1.extractPrivateKeyBytes();

  final keyPair2 = await algorithm.newKeyPairFromSeed(seed);
  final pubKey1 = await keyPair1.extractPublicKey();
  final pubKey2 = await keyPair2.extractPublicKey();

  print('Pub key 1: ${base64Encode(pubKey1.bytes)}');
  print('Pub key 2: ${base64Encode(pubKey2.bytes)}');
  print('Keys equal: ${base64Encode(pubKey1.bytes) == base64Encode(pubKey2.bytes)}');
}
