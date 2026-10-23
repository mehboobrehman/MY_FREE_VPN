const { posts, comments, flags, moderateContent } = require('../models/socialStore');
const { registeredDevices } = require('../models/store');
const { v4: uuidv4 } = require('uuid');

async function createPost(req, res) {
  const { content, tags } = req.body;
  const deviceUuid = req.headers['x-device-uuid'];

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'INVALID_CONTENT', message: 'Post content is required and must be a non-empty string.' });
  }

  // Automated moderation trigger (Acceptance Criterion 2)
  const moderation = moderateContent(content);
  const postId = uuidv4();
  const timestamp = Date.now();

  const post = {
    post_id: postId,
    author_uuid: deviceUuid,
    pseudonym_id: `anon_${deviceUuid.substring(0, 8)}`,
    content: content.trim(),
    tags: Array.isArray(tags) ? tags : [],
    created_at: timestamp,
    flagged: moderation.flagged,
    moderation_reason: moderation.reason
  };

  posts.set(postId, post);

  if (moderation.flagged) {
    const flagId = uuidv4();
    flags.set(flagId, {
      flag_id: flagId,
      target_type: 'post',
      target_id: postId,
      reason: moderation.reason,
      created_at: timestamp
    });
  }

  return res.status(201).json({
    status: 'success',
    post
  });
}

async function getPosts(req, res) {
  const { tag, limit = 20, offset = 0 } = req.query;
  let allPosts = Array.from(posts.values()).filter(p => !p.flagged); // Filter out flagged posts from public feed

  if (tag) {
    allPosts = allPosts.filter(p => p.tags && p.tags.includes(tag));
  }

  // Sort by newest first
  allPosts.sort((a, b) => b.created_at - a.created_at);

  const paginated = allPosts.slice(Number(offset), Number(offset) + Number(limit));

  return res.status(200).json({
    status: 'success',
    count: paginated.length,
    total: allPosts.length,
    posts: paginated
  });
}

async function createComment(req, res) {
  const { postId } = req.params;
  const { content } = req.body;
  const deviceUuid = req.headers['x-device-uuid'];

  if (!posts.has(postId)) {
    return res.status(404).json({ error: 'POST_NOT_FOUND', message: 'The target post does not exist.' });
  }

  if (!content || typeof content !== 'string' || content.trim() === '') {
    return res.status(400).json({ error: 'INVALID_CONTENT', message: 'Comment content is required.' });
  }

  const moderation = moderateContent(content);
  const commentId = uuidv4();
  const timestamp = Date.now();

  const comment = {
    comment_id: commentId,
    post_id: postId,
    author_uuid: deviceUuid,
    pseudonym_id: `anon_${deviceUuid.substring(0, 8)}`,
    content: content.trim(),
    created_at: timestamp,
    flagged: moderation.flagged,
    moderation_reason: moderation.reason
  };

  comments.set(commentId, comment);

  if (moderation.flagged) {
    const flagId = uuidv4();
    flags.set(flagId, {
      flag_id: flagId,
      target_type: 'comment',
      target_id: commentId,
      reason: moderation.reason,
      created_at: timestamp
    });
  }

  return res.status(201).json({
    status: 'success',
    comment
  });
}

async function getComments(req, res) {
  const { postId } = req.params;

  if (!posts.has(postId)) {
    return res.status(404).json({ error: 'POST_NOT_FOUND', message: 'The target post does not exist.' });
  }

  const postComments = Array.from(comments.values())
    .filter(c => c.post_id === postId && !c.flagged)
    .sort((a, b) => a.created_at - b.created_at);

  return res.status(200).json({
    status: 'success',
    count: postComments.length,
    comments: postComments
  });
}

async function getUserProfile(req, res) {
  const deviceUuid = req.headers['x-device-uuid'];
  const device = registeredDevices.get(deviceUuid);

  if (!device) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND', message: 'Device not found.' });
  }

  const userPosts = Array.from(posts.values()).filter(p => p.author_uuid === deviceUuid);
  const userComments = Array.from(comments.values()).filter(c => c.author_uuid === deviceUuid);

  return res.status(200).json({
    status: 'success',
    profile: {
      pseudonym_id: `anon_${deviceUuid.substring(0, 8)}`,
      device_uuid: deviceUuid,
      platform: device.platform,
      registered_at: device.registered_at,
      posts_count: userPosts.length,
      comments_count: userComments.length
    }
  });
}

module.exports = {
  createPost,
  getPosts,
  createComment,
  getComments,
  getUserProfile
};
