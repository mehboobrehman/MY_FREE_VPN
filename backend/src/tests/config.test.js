const test = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const request = require('supertest');

test('API /api/v1/config returns remote configuration and feature flags', async () => {
  const res = await request(app).get('/api/v1/config');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
  assert.ok(res.body.config);
  assert.ok(res.body.config.features);
  assert.strictEqual(typeof res.body.config.features.smart_dns_enabled, 'boolean');
});

test('API /api/v1/config updates remote configuration via POST', async () => {
  const res = await request(app)
    .post('/api/v1/config')
    .send({
      announcement: 'Test Announcement',
      error_simulation_rate: 0.0,
      features: { smart_dns_enabled: false }
    });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.config.announcement, 'Test Announcement');
  assert.strictEqual(res.body.config.features.smart_dns_enabled, false);
});
