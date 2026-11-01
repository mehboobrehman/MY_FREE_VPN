const express = require('express');
const router = express.Router();
const { registeredDevices } = require('../models/store');

// In-memory config store for remote feature flags & error simulation
let remoteConfig = {
  version: 1,
  error_simulation_rate: 0.0, // 0.0 to 1.0 (percentage of simulated failures for testing resilience)
  simulated_latency_ms: 0,
  features: {
    smart_dns_enabled: true,
    p2p_relay_enabled: true,
    telemetry_batch_size: 50,
    debug_overlay_enabled: true
  },
  announcement: 'Welcome to MY_FREE_VPN - Lifetime Free Zero Setup VPN.'
};

// GET /api/v1/config - Retrieve remote configuration and feature flags
router.get('/', (req, res) => {
  // Optional simulated latency
  const latency = remoteConfig.simulated_latency_ms || 0;
  
  const sendResponse = () => {
    // Optional error simulation for testing client resilience
    if (remoteConfig.error_simulation_rate > 0 && Math.random() < remoteConfig.error_simulation_rate) {
      return res.status(500).json({
        error: 'SIMULATED_SERVER_ERROR',
        message: 'Simulated backend error triggered by remote configuration feature flag.'
      });
    }

    return res.status(200).json({
      status: 'success',
      config: remoteConfig,
      timestamp: Date.now()
    });
  };

  if (latency > 0) {
    setTimeout(sendResponse, latency);
  } else {
    sendResponse();
  }
});

// POST /api/v1/config - Update remote configuration (admin / debug feature)
router.post('/', (req, res) => {
  const { error_simulation_rate, simulated_latency_ms, features, announcement } = req.body;

  if (error_simulation_rate !== undefined) {
    remoteConfig.error_simulation_rate = Number(error_simulation_rate);
  }
  if (simulated_latency_ms !== undefined) {
    remoteConfig.simulated_latency_ms = Number(simulated_latency_ms);
  }
  if (features && typeof features === 'object') {
    remoteConfig.features = { ...remoteConfig.features, ...features };
  }
  if (announcement !== undefined) {
    remoteConfig.announcement = announcement;
  }
  remoteConfig.version += 1;

  return res.status(200).json({
    status: 'success',
    message: 'Remote configuration updated successfully.',
    config: remoteConfig
  });
});

module.exports = router;
