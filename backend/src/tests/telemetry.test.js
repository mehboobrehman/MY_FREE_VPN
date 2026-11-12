const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const app = require('../index');
const ADMIN_TOKEN = 'freevpn_debug_token_xyz';

test('Telemetry Event Ingestion and Connection Metrics API', async () => {
  const request = supertest(app);

  // 1. Ingest single telemetry event
  const res1 = await request
    .post('/api/v1/telemetry/events')
    .send({
      eventType: 'vpn_connect',
      clientId: 'test-device-uuid-123',
      bytesTransferred: 1024,
      nodeId: 'node-us-east-01'
    });
  
  assert.strictEqual(res1.status, 201);
  assert.strictEqual(res1.body.success, true);
  assert.strictEqual(res1.body.ingestedCount, 1);

  // 2. Ingest batch telemetry events
  const res2 = await request
    .post('/api/v1/telemetry/events')
    .send([
      { eventType: 'speed_test', downloadSpeedMbps: 85.5 },
      { eventType: 'vpn_disconnect', clientId: 'test-device-uuid-123' }
    ]);

  assert.strictEqual(res2.status, 201);
  assert.strictEqual(res2.body.ingestedCount, 2);

  // 3. Inspect incoming connection metrics
  const res3 = await request
    .get('/api/v1/telemetry/metrics')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.status, 'success');
  assert.strictEqual(res3.body.metrics.totalIngested, 3);
  assert.strictEqual(res3.body.metrics.eventsByType['vpn_connect'], 1);
  assert.strictEqual(res3.body.metrics.eventsByType['speed_test'], 1);
  assert.strictEqual(res3.body.metrics.eventsByType['vpn_disconnect'], 1);
  assert.strictEqual(res3.body.metrics.bytesTransferredTotal, 1024);

  // 4. Retrieve recent events
  const res4 = await request
    .get('/api/v1/telemetry/events')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.events.length, 3);
});

test('Telemetry API Authentication Enforcement', async () => {
  const request = supertest(app);

  const protectedEndpoints = [
    ['GET', '/api/v1/telemetry/metrics'],
    ['GET', '/api/v1/telemetry/events'],
    ['GET', '/api/v1/telemetry/devices'],
    ['GET', '/api/v1/telemetry/sessions'],
    ['POST', '/api/v1/telemetry/commands'],
    ['POST', '/api/v1/telemetry/config/test-device']
  ];

  for (const [method, route] of protectedEndpoints) {
    const res = await (method === 'GET' ? request.get(route) : request.post(route).send({}));
    assert.strictEqual(res.status, 401, `Route ${method} ${route} should require authentication`);
    assert.strictEqual(res.body.error, 'Unauthorized');
  }

  // Verify x-debug-token header also works
  const resAuth = await request
    .get('/api/v1/telemetry/metrics')
    .set('x-debug-token', 'freevpn_debug_token_xyz');
  assert.strictEqual(resAuth.status, 200, 'x-debug-token header should be accepted');
});
