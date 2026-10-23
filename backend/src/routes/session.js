const express = require('express');
const router = express.Router();
const { connectSession, disconnectSession } = require('../controllers/sessionController');

router.post('/connect', connectSession);
router.post('/disconnect', disconnectSession);

module.exports = router;
