const express = require('express');
const router = express.Router();
const { verifyDeviceSignature } = require('../middleware/authMiddleware');
const {
  createPost,
  getPosts,
  createComment,
  getComments,
  getUserProfile
} = require('../controllers/socialController');

// All social routes require cryptographic device authentication (zero-signup pseudonymous identity)
router.post('/posts', verifyDeviceSignature, createPost);
router.get('/posts', verifyDeviceSignature, getPosts);
router.post('/posts/:postId/comments', verifyDeviceSignature, createComment);
router.get('/posts/:postId/comments', verifyDeviceSignature, getComments);
router.get('/profile', verifyDeviceSignature, getUserProfile);

module.exports = router;
