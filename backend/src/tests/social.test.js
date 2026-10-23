const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const app = require('../index');
const { registeredDevices } = require('../models/store');
const { posts, comments } = require('../models/socialStore');
const nacl = require('tweetnacl');

test('Social Network API & Automated Moderation', async () => {
  const deviceUuid = 'test-device-uuid-12345';
  const keyPair = nacl.sign.keyPair();
  const publicKeyBase64 = Buffer.from(keyPair.publicKey).toString('base64');
  
  const messageBytes = Buffer.from(deviceUuid, 'utf8');
  const signatureBytes = nacl.sign.detached(messageBytes, keyPair.secretKey);
  const signatureBase64 = Buffer.from(signatureBytes).toString('base64');

  // Register device
  registeredDevices.set(deviceUuid, {
    public_key: publicKeyBase64,
    platform: 'android',
    registered_at: Date.now()
  });

  posts.clear();
  comments.clear();

  // Test create post
  const resPost = await request(app)
    .post('/api/v1/social/posts')
    .set('x-device-uuid', deviceUuid)
    .set('x-signature', signatureBase64)
    .send({
      content: 'Hello pseudonymous world!',
      tags: ['vpn', 'privacy']
    });

  assert.strictEqual(resPost.status, 201);
  assert.strictEqual(resPost.body.status, 'success');
  assert.strictEqual(resPost.body.post.content, 'Hello pseudonymous world!');
  assert.ok(resPost.body.post.pseudonym_id);
  assert.strictEqual(resPost.body.post.flagged, false);

  // Test moderation trigger
  const resMod = await request(app)
    .post('/api/v1/social/posts')
    .set('x-device-uuid', deviceUuid)
    .set('x-signature', signatureBase64)
    .send({
      content: 'This is a spam message with malware.',
      tags: ['warning']
    });

  assert.strictEqual(resMod.status, 201);
  assert.strictEqual(resMod.body.post.flagged, true);
  assert.ok(resMod.body.post.moderation_reason);

  // Test get feed excluding flagged posts
  posts.clear();
  posts.set('post-1', {
    post_id: 'post-1',
    author_uuid: deviceUuid,
    pseudonym_id: 'anon_123',
    content: 'Clean post',
    tags: [],
    created_at: Date.now(),
    flagged: false
  });

  const resFeed = await request(app)
    .get('/api/v1/social/posts')
    .set('x-device-uuid', deviceUuid)
    .set('x-signature', signatureBase64);

  assert.strictEqual(resFeed.status, 200);
  assert.strictEqual(resFeed.body.posts.length, 1);
  assert.strictEqual(resFeed.body.posts[0].post_id, 'post-1');

  // Test comments
  const resComment = await request(app)
    .post('/api/v1/social/posts/post-1/comments')
    .set('x-device-uuid', deviceUuid)
    .set('x-signature', signatureBase64)
    .send({
      content: 'Nice post!'
    });

  assert.strictEqual(resComment.status, 201);
  assert.strictEqual(resComment.body.comment.content, 'Nice post!');

  // Test user profile (Note: profile endpoint is /api/v1/social/profile as per router mount at /api/v1/social)
  const resProfile = await request(app)
    .get('/api/v1/social/profile')
    .set('x-device-uuid', deviceUuid)
    .set('x-signature', signatureBase64);

  assert.strictEqual(resProfile.status, 200);
  assert.ok(resProfile.body.profile.pseudonym_id);
  assert.strictEqual(resProfile.body.profile.device_uuid, deviceUuid);
});
