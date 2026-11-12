const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const app = require('../index');
const ADMIN_TOKEN = 'freevpn_debug_token_xyz';

test('Phase 3 Telemetry: Remote Host Commands Dispatch, Poll and Ack', async () => {
  const request = supertest(app);

  // 1. Dispatch remote command
  const dispatchRes = await request
    .post('/api/v1/telemetry/commands')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      action: 'change_log_level',
      params: { level: 'DEBUG' },
      device_id: 'test-device-phase3'
    });

  assert.strictEqual(dispatchRes.status, 201);
  assert.strictEqual(dispatchRes.body.success, true);
  assert.ok(dispatchRes.body.command);
  assert.strictEqual(dispatchRes.body.command.action, 'change_log_level');
  const commandId = dispatchRes.body.command.command_id;

  // 2. Poll pending commands for device
  const pollRes = await request
    .get('/api/v1/telemetry/commands/pending?device_id=test-device-phase3');

  assert.strictEqual(pollRes.status, 200);
  assert.strictEqual(pollRes.body.status, 'success');
  assert.strictEqual(pollRes.body.count, 1);
  assert.strictEqual(pollRes.body.commands[0].command_id, commandId);

  // 3. Send command acknowledgement
  const ackRes = await request
    .post('/api/v1/telemetry/commands/ack')
    .send({
      command_id: commandId,
      action: 'change_log_level',
      device_id: 'test-device-phase3',
      success: true,
      result: { log_level: 'DEBUG' }
    });

  assert.strictEqual(ackRes.status, 201);
  assert.strictEqual(ackRes.body.success, true);
});

test('Phase 3 Telemetry: Ingestion of Crash, ANR, Network and Performance Categories', async () => {
  const request = supertest(app);

  const phase3Events = [
    {
      schema_version: '1.0.0',
      session_id: 'session-phase3-001',
      device_id: 'test-device-phase3',
      sequence_number: 1,
      monotonic_timestamp: 1000.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'crash',
      payload: { crash_type: 'FlutterError', error_message: 'Null pointer exception', fatal: true }
    },
    {
      schema_version: '1.0.0',
      session_id: 'session-phase3-001',
      device_id: 'test-device-phase3',
      sequence_number: 2,
      monotonic_timestamp: 1500.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'anr',
      payload: { hang_duration_ms: 2400, threshold_ms: 2000 }
    },
    {
      schema_version: '1.0.0',
      session_id: 'session-phase3-001',
      device_id: 'test-device-phase3',
      sequence_number: 3,
      monotonic_timestamp: 2000.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'network',
      payload: { method: 'GET', url: 'https://api.myfreevpn.org/nodes', status_code: 200, duration_ms: 145 }
    },
    {
      schema_version: '1.0.0',
      session_id: 'session-phase3-001',
      device_id: 'test-device-phase3',
      sequence_number: 4,
      monotonic_timestamp: 2500.0,
      wall_clock_timestamp: Date.now(),
      message_type: 'performance_sample',
      payload: { startup_latency_ms: 1100, memory_rss_bytes: 48000000, cpu_usage_percent: 2.1 }
    }
  ];

  const ingestRes = await request
    .post('/api/v1/telemetry/events')
    .send(phase3Events);

  assert.strictEqual(ingestRes.status, 201);
  assert.strictEqual(ingestRes.body.ingestedCount, 4);

  // Verify retrieval via extension / category endpoints
  const crashExt = await request
    .get('/api/v1/telemetry/extensions/crash')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(crashExt.status, 200);
  assert.strictEqual(crashExt.body.count > 0, true);

  const anrExt = await request
    .get('/api/v1/telemetry/extensions/anr')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(anrExt.status, 200);
  assert.strictEqual(anrExt.body.count > 0, true);

  const netExt = await request
    .get('/api/v1/telemetry/extensions/network')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(netExt.status, 200);
  assert.strictEqual(netExt.body.count > 0, true);

  const perfExt = await request
    .get('/api/v1/telemetry/extensions/performance')
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(perfExt.status, 200);
  assert.strictEqual(perfExt.body.count > 0, true);
});
