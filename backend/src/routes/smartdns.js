const express = require('express');
const router = express.Router();
const { registeredDevices } = require('../models/store');

// Smart DNS routing rules & configuration endpoint
router.post('/config', (req, res) => {
  const { device_uuid } = req.body;

  if (!device_uuid || !registeredDevices.has(device_uuid)) {
    return res.status(400).json({
      error: 'UNREGISTERED_DEVICE',
      message: 'Valid registered device_uuid is required for Smart DNS configuration.'
    });
  }

  // Returns Smart DNS configuration payload for streaming unblocking
  return res.status(200).json({
    smart_dns_status: 'active',
    primary_dns: '195.201.0.1',
    secondary_dns: '138.201.0.3',
    redirection_rules: [
      { domain: '*.netflix.com', target_region: 'US' },
      { domain: '*.hulu.com', target_region: 'US' },
      { domain: '*.bbc.co.uk', target_region: 'GB' },
      { domain: '*.disneyplus.com', target_region: 'US' },
      { domain: '*.primevideo.com', target_region: 'US' }
    ],
    zero_log_policy: 'strictly_enforced'
  });
});

module.exports = router;
