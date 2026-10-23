const express = require('express');
const router = express.Router();
const { registerDevice } = require('../controllers/authController');

router.post('/register', registerDevice);

module.exports = router;
