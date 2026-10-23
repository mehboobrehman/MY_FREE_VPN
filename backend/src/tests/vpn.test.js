const test = require('node:test');
const assert = require('node:assert');
const nacl = require('tweetnacl');
const { v4: uuidv4 } = require('uuid');
const { verifySignature } = require('../controllers/authController');
const app = require('../index');
const request = require('supertest');

test('Cryptographic Signature Verification for Device Registration', () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  const publicKeyB64 = Buffer.from(keyPair.publicKey).toString('base64');
  const signatureB64 = Buffer.from(signature).toString('base64');

  const isValid = verifySignature(deviceUuid, publicKeyB64, signatureB64);
  assert.strictEqual(isValid, true);

  // Test invalid signature
  const invalidSigB64 = Buffer.from(nacl.sign.detached(Buffer.from('wrong-uuid', 'utf8'), keyPair.secretKey)).toString('base64');
  const isInvalid = verifySignature(deviceUuid, publicKeyB64, invalidSigB64);
  assert.strictEqual(isInvalid, false);
});

test('API /api/v1/status endpoint returns healthy', async () => {
  const res = await request(app).get('/api/v1/status');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'healthy');
  assert.ok(typeof res.body.timestamp === 'number');
});

test('API /api/v1/auth/register endpoint succeeds with valid cryptographic proof', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: Buffer.from(keyPair.publicKey).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
      platform: 'android',
      app_version: '1.0.0'
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
  assert.strictEqual(res.body.device_id, deviceUuid);
});

test('API /api/v1/nodes?streaming=true returns streaming nodes', async () => {
  const res = await request(app).get('/api/v1/nodes?streaming=true');
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.body.nodes));
  assert.ok(res.body.nodes.length > 0);
  assert.strictEqual(res.body.nodes[0].is_streaming, true);
});

test('API /api/v1/smartdns/config returns smart dns routing rules', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: Buffer.from(keyPair.publicKey).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
      platform: 'windows',
      app_version: '1.0.0'
    });

  const res = await request(app)
    .post('/api/v1/smartdns/config')
    .send({ device_uuid: deviceUuid });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.smart_dns_status, 'active');
  assert.ok(Array.isArray(res.body.redirection_rules));
  assert.ok(res.body.redirection_rules.length > 0);
});

test('API /api/v1/legacy/config returns OpenVPN and PPTP profiles', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: Buffer.from(keyPair.publicKey).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
      platform: 'windows',
      app_version: '1.0.0'
    });

  const resOvpn = await request(app)
    .post('/api/v1/legacy/config')
    .send({ device_uuid: deviceUuid, protocol: 'openvpn' });

  assert.strictEqual(resOvpn.status, 200);
  assert.strictEqual(resOvpn.body.protocol, 'openvpn');
  assert.ok(resOvpn.body.config_file_content);

  const resPptp = await request(app)
    .post('/api/v1/legacy/config')
    .send({ device_uuid: deviceUuid, protocol: 'pptp' });

  assert.strictEqual(resPptp.status, 200);
  assert.strictEqual(resPptp.body.protocol, 'pptp');
  assert.ok(resPptp.body.server_endpoint);
});
