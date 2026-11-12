const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const nacl = require('tweetnacl');
const app = require('../index');


test('Integration Verification: Auth Register', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = 'test-device-' + Date.now();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: Buffer.from(keyPair.publicKey).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
      platform: 'android'
    });
  
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
});

test('Integration Verification: Session Connect', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = 'test-device-session-' + Date.now();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: Buffer.from(keyPair.publicKey).toString('base64'),
      signature: Buffer.from(signature).toString('base64'),
      platform: 'android'
    });

  const res = await request(app)
    .post('/api/v1/session/connect')
    .send({
      device_uuid: deviceUuid,
      node_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789'
    });
  
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.server_public_key, 'server_public_key should be present');
  assert.ok(res.body.client_ip, 'client_ip should be present');
  assert.ok(res.body.session_token, 'session_token should be present');
});

test('Integration Verification: Multiple Sessions IPAM', async () => {
  const devices = [];
  for (let i = 0; i < 5; i++) {
    const keyPair = nacl.sign.keyPair();
    const deviceUuid = 'multi-device-' + i + '-' + Date.now();
    const messageBytes = Buffer.from(deviceUuid, 'utf8');
    const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);

    await request(app)
      .post('/api/v1/auth/register')
      .send({
        device_uuid: deviceUuid,
        public_key: Buffer.from(keyPair.publicKey).toString('base64'),
        signature: Buffer.from(signature).toString('base64'),
        platform: 'android'
      });
    devices.push({ deviceUuid, keyPair });
  }

  const ips = new Set();
  for (const device of devices) {
    const res = await request(app)
      .post('/api/v1/session/connect')
      .send({
        device_uuid: device.deviceUuid,
        node_id: 'a1b2c3d4-e5f6-7890-abcd-ef0123456789'
      });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.client_ip);
    ips.add(res.body.client_ip);
  }

  assert.strictEqual(ips.size, 5, 'Should have 5 unique IPs');
});

test('Security Audit: Admin Routes Protection', async () => {
  const res = await request(app).post('/api/v1/telemetry/commands').send({});
  assert.strictEqual(res.status, 401);
});
