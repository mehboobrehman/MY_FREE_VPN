const test = require('node:test');
const assert = require('node:assert');
const nacl = require('tweetnacl');
const { v4: uuidv4 } = require('uuid');
const app = require('../index');
const request = require('supertest');
const { provisionPeer } = require('../controllers/nodeController');
const { vpnNodes, nodePeers } = require('../models/store');

test('Session Connect: Successful peer provisioning and IPAM allocation (10.8.0.x)', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
  const publicKeyB64 = Buffer.from(keyPair.publicKey).toString('base64');

  // 1. Register device first
  const regRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: publicKeyB64,
      signature: Buffer.from(signature).toString('base64'),
      platform: 'android',
      app_version: '1.0.0'
    });

  assert.strictEqual(regRes.status, 200);

  // Get a valid node_id from vpnNodes
  const nodeEntries = Array.from(vpnNodes.entries());
  assert.ok(nodeEntries.length > 0);
  const [nodeId, nodeObj] = nodeEntries[0];

  // 2. Connect session
  const connectRes = await request(app)
    .post('/api/v1/session/connect')
    .send({
      device_uuid: deviceUuid,
      node_id: nodeId
    });

  assert.strictEqual(connectRes.status, 200);
  assert.ok(connectRes.body.session_token);
  assert.ok(connectRes.body.client_ip);
  assert.match(connectRes.body.client_ip, /^10\.8\.0\.\d+\/32$/);
  assert.strictEqual(connectRes.body.server_endpoint, `${nodeObj.endpoint_ip}:${nodeObj.endpoint_port}`);
  assert.strictEqual(connectRes.body.server_public_key, nodeObj.public_key);

  // Verify peer was registered in nodePeers
  const peersMap = nodePeers.get(nodeId);
  assert.ok(peersMap);
  const peerInfo = peersMap.get(publicKeyB64);
  assert.ok(peerInfo);
  assert.strictEqual(peerInfo.device_uuid, deviceUuid);
  assert.ok(peerInfo.client_ip.startsWith('10.8.0.'));
});

test('Session Connect: Rejection of unregistered device', async () => {
  const unregisteredUuid = uuidv4();
  const nodeEntries = Array.from(vpnNodes.keys());
  const nodeId = nodeEntries[0];

  const res = await request(app)
    .post('/api/v1/session/connect')
    .send({
      device_uuid: unregisteredUuid,
      node_id: nodeId
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'UNREGISTERED_DEVICE');
});

test('Session Connect: Rejection of invalid node', async () => {
  const keyPair = nacl.sign.keyPair();
  const deviceUuid = uuidv4();
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signature = nacl.sign.detached(messageBytes, keyPair.secretKey);
  const publicKeyB64 = Buffer.from(keyPair.publicKey).toString('base64');

  await request(app)
    .post('/api/v1/auth/register')
    .send({
      device_uuid: deviceUuid,
      public_key: publicKeyB64,
      signature: Buffer.from(signature).toString('base64'),
      platform: 'windows',
      app_version: '1.0.0'
    });

  const res = await request(app)
    .post('/api/v1/session/connect')
    .send({
      device_uuid: deviceUuid,
      node_id: 'non-existent-node-id'
    });

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.error, 'INVALID_NODE');
});

test('Direct provisionPeer testing and IPAM behavior', () => {
  const nodeEntries = Array.from(vpnNodes.keys());
  const nodeId = nodeEntries[0];
  const testPubKey = 'TEST_PUBLIC_KEY_' + uuidv4();
  const testDeviceUuid = uuidv4();

  const result = provisionPeer(nodeId, testDeviceUuid, testPubKey);
  assert.ok(result.client_ip);
  assert.match(result.client_ip, /^10\.8\.0\.\d+$/);

  // Verify throwing when node does not exist
  assert.throws(() => {
    provisionPeer('invalid-node-id', testDeviceUuid, testPubKey);
  }, /Node not found/);
});
