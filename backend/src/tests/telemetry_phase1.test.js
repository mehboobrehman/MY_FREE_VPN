const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../index');

test('Phase 1 Live Telemetry: Contract Schema Validation', () => {
  const schemaPath = path.join(__dirname, '../../../contracts/telemetry_envelope.json');
  const schemaRaw = fs.readFileSync(schemaPath, 'utf8');
  const schema = JSON.parse(schemaRaw);

  assert.strictEqual(schema.title, 'TelemetryEnvelope');
  assert.ok(schema.properties.schema_version);
  assert.ok(schema.properties.session_id);
  assert.ok(schema.properties.device_id);
  assert.ok(schema.properties.sequence_number);
  assert.ok(schema.properties.monotonic_timestamp);
  assert.ok(schema.properties.wall_clock_timestamp);
  assert.ok(schema.properties.message_type);
  assert.ok(schema.properties.payload);
});

test('Phase 1 Live Telemetry: Endpoint Discovery API', async () => {
  const request = supertest(app);
  const res = await request.get('/api/v1/telemetry/discovery');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
  assert.ok(res.body.discovery.local_wifi);
  assert.ok(res.body.discovery.local_wifi.http_endpoint);
  assert.ok(res.body.discovery.cloud_relay);
  assert.ok(res.body.discovery.cloud_relay.tunnel_url);
  assert.strictEqual(res.body.discovery.fallback_enabled, true);
});

test('Phase 1 Live Telemetry: Versioned Envelope Ingestion', async () => {
  const request = supertest(app);

  const envelope = {
    schema_version: '1.0.0',
    session_id: '123e4567-e89b-12d3-a456-426614174000',
    device_id: 'test-device-uuid-999',
    sequence_number: 1,
    monotonic_timestamp: 12345.67,
    wall_clock_timestamp: Date.now(),
    message_type: 'event',
    payload: {
      event_type: 'vpn_connect',
      data: { nodeId: 'node-us-01' }
    }
  };

  const res = await request
    .post('/api/v1/telemetry/events')
    .send(envelope);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.ingestedCount, 1);
});

test('Phase 1 Live Telemetry: Section I Extensions (I1-I4)', async () => {
  const request = supertest(app);

  const extensionMessages = [
    {
      schema_version: '1.0.0',
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      device_id: 'test-device-uuid-999',
      sequence_number: 2,
      monotonic_timestamp: 12400.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'state_inspection',
      payload: { inspection_target: 'wireguard_tunnel_state' }
    },
    {
      schema_version: '1.0.0',
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      device_id: 'test-device-uuid-999',
      sequence_number: 3,
      monotonic_timestamp: 12500.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'debugger_attach',
      payload: { data: { action: 'attach' } }
    },
    {
      schema_version: '1.0.0',
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      device_id: 'test-device-uuid-999',
      sequence_number: 4,
      monotonic_timestamp: 12600.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'runtime_logpoints',
      payload: { logpoint_id: 'lp-01' }
    },
    {
      schema_version: '1.0.0',
      session_id: '123e4567-e89b-12d3-a456-426614174000',
      device_id: 'test-device-uuid-999',
      sequence_number: 5,
      monotonic_timestamp: 12700.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'trigger_snapshots',
      payload: { snapshot_trigger: 'on_error' }
    }
  ];

  const res = await request
    .post('/api/v1/telemetry/events')
    .send(extensionMessages);

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.ingestedCount, 4);

  // Verify retrieval of extensions
  const ext1 = await request.get('/api/v1/telemetry/extensions/state_inspection');
  assert.strictEqual(ext1.status, 200);
  assert.strictEqual(ext1.body.count > 0, true);

  const ext2 = await request.get('/api/v1/telemetry/extensions/debugger_attach');
  assert.strictEqual(ext2.status, 200);
  assert.strictEqual(ext2.body.count > 0, true);

  const ext3 = await request.get('/api/v1/telemetry/extensions/runtime_logpoints');
  assert.strictEqual(ext3.status, 200);
  assert.strictEqual(ext3.body.count > 0, true);

  const ext4 = await request.get('/api/v1/telemetry/extensions/trigger_snapshots');
  assert.strictEqual(ext4.status, 200);
  assert.strictEqual(ext4.body.count > 0, true);
});

test('Phase 1 Live Telemetry: Debug-Only Compilation Gating in Production', async () => {
  const originalEnv = process.env.NODE_ENV;
  const originalDebug = process.env.ENABLE_DEBUG_TELEMETRY;

  try {
    process.env.NODE_ENV = 'production';
    delete process.env.ENABLE_DEBUG_TELEMETRY;

    // Reload router / app with production environment gating
    const request = supertest(app);
    const res = await request.get('/api/v1/telemetry/discovery');
    assert.strictEqual(res.status, 404);
  } finally {
    process.env.NODE_ENV = originalEnv;
    if (originalDebug !== undefined) {
      process.env.ENABLE_DEBUG_TELEMETRY = originalDebug;
    } else {
      delete process.env.ENABLE_DEBUG_TELEMETRY;
    }
  }
});
