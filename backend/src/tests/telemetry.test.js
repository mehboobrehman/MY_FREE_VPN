const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const app = require('../index');

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
  const res3 = await request.get('/api/v1/telemetry/metrics');
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.status, 'success');
  assert.strictEqual(res3.body.metrics.totalIngested, 3);
  assert.strictEqual(res3.body.metrics.eventsByType['vpn_connect'], 1);
  assert.strictEqual(res3.body.metrics.eventsByType['speed_test'], 1);
  assert.strictEqual(res3.body.metrics.eventsByType['vpn_disconnect'], 1);
  assert.strictEqual(res3.body.metrics.bytesTransferredTotal, 1024);

  // 4. Retrieve recent events
  const res4 = await request.get('/api/v1/telemetry/events');
  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.events.length, 3);
});
