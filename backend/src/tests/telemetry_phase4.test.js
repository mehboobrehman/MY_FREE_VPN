const test = require('node:test');
const assert = require('node:assert');
const supertest = require('supertest');
const app = require('../index');
const ADMIN_TOKEN = 'freevpn_debug_token_xyz';

test('Phase 4 Telemetry: Storage, Replay, Export & Per-Device Config', async () => {
  const request = supertest(app);
  const uniqueId = Date.now() + '-' + Math.floor(Math.random() * 1000);
  const deviceId = `device-phase4-test-${uniqueId}`;
  const sessionId = `session-phase4-abc-${uniqueId}`;

  // 1. Ingest telemetry envelope events for storage & session creation
  const eventsPayload = [
    {
      schema_version: '1.0.0',
      session_id: sessionId,
      device_id: deviceId,
      sequence_number: 1,
      monotonic_timestamp: 100.0,
      wall_clock_timestamp: Date.now(),
      level: 'info',
      tag: 'vpn',
      message_type: 'vpn_connect',
      payload: { event_type: 'vpn_connect', nodeId: 'node-sg-01', bytesTransferred: 1024 }
    },
    {
      schema_version: '1.0.0',
      session_id: sessionId,
      device_id: deviceId,
      sequence_number: 2,
      monotonic_timestamp: 200.0,
      wall_clock_timestamp: Date.now(),
      level: 'error',
      tag: 'network',
      message_type: 'network',
      payload: {
        method: 'GET',
        url: 'https://api.myfreevpn.org/health',
        status_code: 200,
        duration_ms: 120,
        request_headers: { 'Authorization': 'Bearer test' },
        response_headers: { 'Content-Type': 'application/json' },
        body: { status: 'ok' }
      }
    },
    {
      schema_version: '1.0.0',
      session_id: sessionId,
      device_id: deviceId,
      sequence_number: 3,
      monotonic_timestamp: 300.0,
      wall_clock_timestamp: Date.now(),
      level: 'error',
      tag: 'crash',
      message_type: 'crash',
      payload: { crash_type: 'UnhandledException', error_message: 'Test crash payload', fatal: true }
    }
  ];

  const ingestRes = await request
    .post('/api/v1/telemetry/events')
    .send(eventsPayload);

  assert.strictEqual(ingestRes.status, 201);
  assert.strictEqual(ingestRes.body.success, true);
  assert.strictEqual(ingestRes.body.ingestedCount, 3);

  // 2. Test GET /api/v1/telemetry/sessions (listing sessions with metadata)
  const sessionsRes = await request
    .get(`/api/v1/telemetry/sessions?device_id=${deviceId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(sessionsRes.status, 200);
  assert.strictEqual(sessionsRes.body.status, 'success');
  assert.ok(sessionsRes.body.sessions.length > 0);
  
  const targetSession = sessionsRes.body.sessions.find(s => s.session_id === sessionId);
  assert.ok(targetSession);
  assert.strictEqual(targetSession.device_id, deviceId);
  assert.strictEqual(targetSession.event_count, 3);
  assert.ok(targetSession.event_types.network);
  assert.ok(targetSession.event_types.crash);

  // 3. Test GET /api/v1/telemetry/sessions/:id (retrieve session events with filters)
  const sessionEventsRes = await request
    .get(`/api/v1/telemetry/sessions/${sessionId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(sessionEventsRes.status, 200);
  assert.strictEqual(sessionEventsRes.body.status, 'success');
  assert.strictEqual(sessionEventsRes.body.session_id, sessionId);
  assert.strictEqual(sessionEventsRes.body.device_id, deviceId);
  assert.strictEqual(sessionEventsRes.body.total_events, 3);
  assert.strictEqual(sessionEventsRes.body.events.length, 3);

  // Test filtering by type
  const filteredEventsRes = await request
    .get(`/api/v1/telemetry/sessions/${sessionId}?type=network`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(filteredEventsRes.status, 200);
  assert.strictEqual(filteredEventsRes.body.events.length, 1);
  assert.strictEqual(filteredEventsRes.body.events[0].message_type, 'network');

  // 4. Test GET /api/v1/telemetry/sessions/:id/export (JSON format)
  const exportJsonRes = await request
    .get(`/api/v1/telemetry/sessions/${sessionId}/export?format=json`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(exportJsonRes.status, 200);
  assert.ok(exportJsonRes.body.session_id);
  assert.ok(exportJsonRes.body.events);
  assert.strictEqual(exportJsonRes.body.events.length, 3);

  // 5. Test GET /api/v1/telemetry/sessions/:id/export (HAR format)
  const exportHarRes = await request
    .get(`/api/v1/telemetry/sessions/${sessionId}/export?format=har`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`);
  assert.strictEqual(exportHarRes.status, 200);
  assert.ok(exportHarRes.body.log);
  assert.strictEqual(exportHarRes.body.log.version, '1.2');
  assert.ok(Array.isArray(exportHarRes.body.log.entries));
  assert.strictEqual(exportHarRes.body.log.entries.length, 1); // 1 network event converted to HAR entry
  assert.strictEqual(exportHarRes.body.log.entries[0].request.url, 'https://api.myfreevpn.org/health');

  // 6. Test GET /api/v1/telemetry/config/:deviceId (get per-device config)
  const getConfigRes = await request.get(`/api/v1/telemetry/config/${deviceId}`);
  assert.strictEqual(getConfigRes.status, 200);
  assert.strictEqual(getConfigRes.body.status, 'success');
  assert.strictEqual(getConfigRes.body.config.device_id, deviceId);
  assert.ok(getConfigRes.body.config.log_level);

  // 7. Test POST /api/v1/telemetry/config/:deviceId (set per-device config)
  const setConfigRes = await request
    .post(`/api/v1/telemetry/config/${deviceId}`)
    .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
    .send({
      log_level: 'DEBUG',
      sampling_rate: 0.5,
      logpoints: [{ id: 'lp-01', enabled: true }]
    });

  assert.strictEqual(setConfigRes.status, 200);
  assert.strictEqual(setConfigRes.body.status, 'success');
  assert.strictEqual(setConfigRes.body.config.log_level, 'DEBUG');
  assert.strictEqual(setConfigRes.body.config.sampling_rate, 0.5);
  assert.strictEqual(setConfigRes.body.config.logpoints.length, 1);
});
