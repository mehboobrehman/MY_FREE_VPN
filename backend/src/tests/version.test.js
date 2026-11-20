const test = require('node:test');
const assert = require('node:assert');
const app = require('../index');
const request = require('supertest');
const fs = require('fs');
const path = require('path');

test('API /api/v1/version returns version from version.json', async () => {
  const versionFilePath = path.join(__dirname, '../../../version.json');
  const expectedVersion = JSON.parse(fs.readFileSync(versionFilePath, 'utf8')).version;

  const res = await request(app).get('/api/v1/version');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
  assert.strictEqual(res.body.version, expectedVersion);
});

test('API /api/v1/config/version returns version from version.json', async () => {
  const versionFilePath = path.join(__dirname, '../../../version.json');
  const expectedVersion = JSON.parse(fs.readFileSync(versionFilePath, 'utf8')).version;

  const res = await request(app).get('/api/v1/config/version');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'success');
  assert.strictEqual(res.body.version, expectedVersion);
});
