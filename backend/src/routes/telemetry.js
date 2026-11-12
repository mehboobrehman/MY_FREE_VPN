const express = require('express');
const router = express.Router();
const os = require('os');
const adminAuthMiddleware = require('../middleware/adminAuth');
const telemetryStorage = require('../models/telemetryStorage');

function getLocalLanIp() {
  if (process.env.LOCAL_IP) return process.env.LOCAL_IP;
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '192.168.1.150';
}

// In-memory telemetry storage & metrics
const telemetryEvents = [];
const extensionDataStore = {
  stateInspections: [],
  debuggerSessions: [],
  runtimeLogpoints: [],
  triggerSnapshots: [],
  crashes: [],
  anrs: [],
  networks: [],
  performances: [],
  commandAcks: []
};

const pendingCommandsQueue = [];

const connectionMetrics = {
  totalIngested: 0,
  eventsByType: {},
  lastIngestedAt: null,
  activeConnectionsCount: 0,
  bytesTransferredTotal: 0
};

// 3. Strict Debug-Only Compilation Gating Middleware
const debugGatingMiddleware = (_req, res, next) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const debugEnabled = process.env.ENABLE_DEBUG_TELEMETRY === 'true';
  if (isProduction && !debugEnabled) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
  next();
};

router.use(debugGatingMiddleware);

// 2. Endpoint Discovery Mechanism supporting Local Wi-Fi Network IP and Cloud Relay / Local Tunnel fallback
router.get('/discovery', (req, res) => {
  const localIp = getLocalLanIp();
  const port = process.env.PORT || 48392;
  const tunnelUrl = process.env.TUNNEL_URL || 'https://myfreevpn-debug-relay.ngrok-free.app';
  
  const deviceId = req.query.device_id;
  const remoteAddress = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  console.log(`[Telemetry Discovery] Request from IP: ${remoteAddress}, User-Agent: ${userAgent}`);
  telemetryStorage.recordDiscoveryHit(deviceId, remoteAddress);

  return res.json({
    status: 'success',
    discovery: {
      local_wifi: {
        enabled: true,
        http_endpoint: `http://${localIp}:${port}/api/v1/telemetry/events`,
        websocket_endpoint: `ws://${localIp}:${port}/api/v1/telemetry/ws`
      },
      cloud_relay: {
        enabled: true,
        tunnel_url: tunnelUrl,
        http_endpoint: `${tunnelUrl}/api/v1/telemetry/events`,
        websocket_endpoint: `${tunnelUrl.replace(/^http/, 'ws')}/api/v1/telemetry/ws`
      },
      preferred: process.env.PREFERRED_TELEMETRY_ENDPOINT || 'local_wifi',
      fallback_enabled: true
    }
  });
});

// Helper to validate telemetry message envelope
function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') return 'Invalid envelope object';
  if (!envelope.schema_version) return 'Missing schema_version';
  if (!envelope.session_id) return 'Missing session_id';
  if (!envelope.device_id) return 'Missing device_id';
  if (envelope.sequence_number === undefined) return 'Missing sequence_number';
  if (envelope.monotonic_timestamp === undefined) return 'Missing monotonic_timestamp';
  if (envelope.wall_clock_timestamp === undefined) return 'Missing wall_clock_timestamp';
  if (!envelope.message_type) return 'Missing message_type';
  if (!envelope.payload || typeof envelope.payload !== 'object') return 'Missing or invalid payload';
  return null;
}

// POST /api/v1/telemetry/events - ingest telemetry events and versioned envelopes
router.post('/events', (req, res) => {
  const remoteAddress = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
  try {
    const payload = req.body;
    const items = Array.isArray(payload) ? payload : [payload];

    const timestamp = Date.now();
    for (const item of items) {
      const isEnvelope = item.schema_version && item.message_type;
      
      if (isEnvelope) {
        const err = validateEnvelope(item);
        if (err) {
          console.warn(`[Telemetry] Failed /events ingestion: Envelope validation failed - ${err} (IP: ${remoteAddress})`);
          return res.status(400).json({ error: `Envelope validation failed: ${err}` });
        }
      } else {
        if (!item.eventType && !item.type) {
          console.warn(`[Telemetry] Failed /events ingestion: Missing eventType or type (IP: ${remoteAddress})`);
          return res.status(400).json({ error: 'Missing eventType or type in telemetry event' });
        }
      }

      const messageType = isEnvelope ? item.message_type : (item.eventType || item.type);
      
      const record = {
        ...item,
        receivedAt: timestamp
      };

      // Save to persistent storage and memory index
      telemetryStorage.saveEvent(record, remoteAddress);
      telemetryEvents.push(record);

      // Handle Section I & Phase 3 categories
      if (isEnvelope) {
        switch (item.message_type) {
          case 'state_inspection':
            extensionDataStore.stateInspections.push(record);
            break;
          case 'debugger_attach':
            extensionDataStore.debuggerSessions.push(record);
            break;
          case 'runtime_logpoints':
            extensionDataStore.runtimeLogpoints.push(record);
            break;
          case 'trigger_snapshots':
          case 'snapshot_dump':
            extensionDataStore.triggerSnapshots.push(record);
            break;
          case 'crash':
            extensionDataStore.crashes.push(record);
            break;
          case 'anr':
            extensionDataStore.anrs.push(record);
            break;
          case 'network':
            extensionDataStore.networks.push(record);
            break;
          case 'performance_sample':
            extensionDataStore.performances.push(record);
            break;
          case 'command_ack':
            extensionDataStore.commandAcks.push(record);
            break;
        }
      }

      connectionMetrics.totalIngested++;
      connectionMetrics.eventsByType[messageType] = (connectionMetrics.eventsByType[messageType] || 0) + 1;
      
      if (item.bytesTransferred || (item.payload && item.payload.bytesTransferred)) {
        connectionMetrics.bytesTransferredTotal += Number(item.bytesTransferred || item.payload.bytesTransferred) || 0;
      }
      if (messageType === 'vpn_connect' || (item.payload && item.payload.event_type === 'vpn_connect')) {
        connectionMetrics.activeConnectionsCount++;
      } else if (messageType === 'vpn_disconnect' || (item.payload && item.payload.event_type === 'vpn_disconnect')) {
        connectionMetrics.activeConnectionsCount = Math.max(0, connectionMetrics.activeConnectionsCount - 1);
      }
    }

    connectionMetrics.lastIngestedAt = timestamp;

    if (telemetryEvents.length > 1000) {
      telemetryEvents.splice(0, telemetryEvents.length - 1000);
    }

    return res.status(201).json({
      success: true,
      ingestedCount: items.length,
      totalIngested: connectionMetrics.totalIngested
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/devices - list all known telemetry devices
router.get('/devices', adminAuthMiddleware, (_req, res) => {
  try {
    const devices = telemetryStorage.getDevices();
    return res.json({
      status: 'success',
      count: devices.length,
      devices
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/metrics - inspect incoming connection metrics
router.get('/metrics', adminAuthMiddleware, (_req, res) => {
  return res.json({
    status: 'success',
    metrics: connectionMetrics,
    recentEventsCount: telemetryEvents.length,
    extensions: {
      state_inspections_count: extensionDataStore.stateInspections.length,
      debugger_sessions_count: extensionDataStore.debuggerSessions.length,
      runtime_logpoints_count: extensionDataStore.runtimeLogpoints.length,
      trigger_snapshots_count: extensionDataStore.triggerSnapshots.length,
      crashes_count: extensionDataStore.crashes.length,
      anrs_count: extensionDataStore.anrs.length,
      networks_count: extensionDataStore.networks.length,
      performances_count: extensionDataStore.performances.length,
      command_acks_count: extensionDataStore.commandAcks.length
    }
  });
});

// GET /api/v1/telemetry/events - view recent telemetry events
router.get('/events', adminAuthMiddleware, (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const typeFilter = req.query.type;
  
  let events = telemetryEvents;
  if (typeFilter) {
    events = events.filter(e => e.message_type === typeFilter || e.eventType === typeFilter || e.type === typeFilter);
  }

  return res.json({
    status: 'success',
    events: events.slice(-limit)
  });
});

// --- Phase 4 Operational & Session Replay Endpoints ---

// GET /api/v1/telemetry/sessions - List sessions with metadata
router.get('/sessions', adminAuthMiddleware, (req, res) => {
  try {
    const deviceId = req.query.device_id;
    const sessions = telemetryStorage.getSessions({ device_id: deviceId });
    return res.json({
      status: 'success',
      count: sessions.length,
      sessions
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/sessions/:id - Retrieve session events
router.get('/sessions/:id', adminAuthMiddleware, (req, res) => {
  try {
    const sessionId = req.params.id;
    const result = telemetryStorage.getSessionEvents(sessionId, req.query);
    if (!result) {
      return res.status(404).json({ error: 'Session not found' });
    }
    return res.json({
      status: 'success',
      ...result
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/sessions/:id/export - Export session logs in open JSON or HAR format
router.get('/sessions/:id/export', adminAuthMiddleware, (req, res) => {
  try {
    const sessionId = req.params.id;
    const format = req.query.format || 'json';
    if (format !== 'json' && format !== 'har') {
      return res.status(400).json({ error: 'Invalid export format. Supported: json, har' });
    }
    const exported = telemetryStorage.exportSession(sessionId, format);
    if (!exported) {
      return res.status(404).json({ error: 'Session not found for export' });
    }

    if (format === 'har') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="telemetry_session_${sessionId}.har"`);
      return res.send(JSON.stringify(exported, null, 2));
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="telemetry_session_${sessionId}.json"`);
      return res.send(JSON.stringify(exported, null, 2));
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/config/:deviceId - Get configuration per device
router.get('/config/:deviceId', (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const config = telemetryStorage.getConfig(deviceId);
    return res.json({
      status: 'success',
      config
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/telemetry/config/:deviceId - Set configuration per device
router.post('/config/:deviceId', adminAuthMiddleware, (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    const updated = telemetryStorage.setConfig(deviceId, req.body);
    return res.json({
      status: 'success',
      message: 'Device configuration updated successfully',
      config: updated
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/extensions/:type - inspect extension & telemetry category data
router.get('/extensions/:type', adminAuthMiddleware, (req, res) => {
  const extType = req.params.type;
  let data = [];
  if (extType === 'state_inspection') data = extensionDataStore.stateInspections;
  else if (extType === 'debugger_attach') data = extensionDataStore.debuggerSessions;
  else if (extType === 'runtime_logpoints') data = extensionDataStore.runtimeLogpoints;
  else if (extType === 'trigger_snapshots') data = extensionDataStore.triggerSnapshots;
  else if (extType === 'crash') data = extensionDataStore.crashes;
  else if (extType === 'anr') data = extensionDataStore.anrs;
  else if (extType === 'network') data = extensionDataStore.networks;
  else if (extType === 'performance') data = extensionDataStore.performances;
  else if (extType === 'command_ack') data = extensionDataStore.commandAcks;
  else return res.status(404).json({ error: 'Unknown extension/category type' });

  return res.json({
    status: 'success',
    extension_type: extType,
    count: data.length,
    items: data.slice(-50)
  });
});

// --- Phase 3 Remote Host Commands Endpoints ---
const allowListedActions = ['change_log_level', 'change_sampling', 'toggle_categories', 'request_snapshot'];

// POST /api/v1/telemetry/commands - dispatch a remote command to device agent
router.post('/commands', adminAuthMiddleware, (req, res) => {
  try {
    const { action, params, device_id } = req.body;
    if (!action || !allowListedActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid or unauthorized command action. Allowed: ${allowListedActions.join(', ')}`
      });
    }

    const commandId = 'cmd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const cmd = {
      command_id: commandId,
      device_id: device_id || 'all',
      action,
      params: params || {},
      status: 'pending',
      createdAt: Date.now()
    };

    pendingCommandsQueue.push(cmd);
    return res.status(201).json({ success: true, command: cmd });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/commands/pending - device agent polls pending commands
router.get('/commands/pending', (req, res) => {
  try {
    const deviceId = req.query.device_id;
    const matchedCommands = [];
    const remainingCommands = [];

    for (const c of pendingCommandsQueue) {
      if (!deviceId || c.device_id === 'all' || c.device_id === deviceId) {
        matchedCommands.push(c);
      } else {
        remainingCommands.push(c);
      }
    }

    pendingCommandsQueue.length = 0;
    pendingCommandsQueue.push(...remainingCommands);

    return res.json({
      status: 'success',
      count: matchedCommands.length,
      commands: matchedCommands
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v1/telemetry/commands/ack - device agent acknowledges command execution
router.post('/commands/ack', (req, res) => {
  try {
    const ack = req.body;
    if (!ack.command_id || !ack.action) {
      return res.status(400).json({ error: 'Missing command_id or action in ack' });
    }

    const record = {
      ...ack,
      receivedAt: Date.now()
    };

    extensionDataStore.commandAcks.push(record);
    connectionMetrics.totalIngested++;
    connectionMetrics.eventsByType['command_ack'] = (connectionMetrics.eventsByType['command_ack'] || 0) + 1;

    return res.status(201).json({ success: true, acknowledged: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
