const express = require('express');
const router = express.Router();

// In-memory telemetry storage & metrics
const telemetryEvents = [];
const connectionMetrics = {
  totalIngested: 0,
  eventsByType: {},
  lastIngestedAt: null,
  activeConnectionsCount: 0,
  bytesTransferredTotal: 0
};

// POST /api/v1/telemetry/events - ingest telemetry events
router.post('/events', (req, res) => {
  try {
    const payload = req.body;
    const events = Array.isArray(payload) ? payload : [payload];

    const timestamp = Date.now();
    for (const event of events) {
      if (!event.eventType && !event.type) {
        return res.status(400).json({ error: 'Missing eventType or type in telemetry event' });
      }
      const type = event.eventType || event.type;
      telemetryEvents.push({
        ...event,
        receivedAt: timestamp
      });

      connectionMetrics.totalIngested++;
      connectionMetrics.eventsByType[type] = (connectionMetrics.eventsByType[type] || 0) + 1;
      
      if (event.bytesTransferred) {
        connectionMetrics.bytesTransferredTotal += Number(event.bytesTransferred) || 0;
      }
      if (type === 'vpn_connect') {
        connectionMetrics.activeConnectionsCount++;
      } else if (type === 'vpn_disconnect') {
        connectionMetrics.activeConnectionsCount = Math.max(0, connectionMetrics.activeConnectionsCount - 1);
      }
    }

    connectionMetrics.lastIngestedAt = timestamp;

    // Keep only last 1000 events in memory
    if (telemetryEvents.length > 1000) {
      telemetryEvents.splice(0, telemetryEvents.length - 1000);
    }

    return res.status(201).json({
      success: true,
      ingestedCount: events.length,
      totalIngested: connectionMetrics.totalIngested
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v1/telemetry/metrics - inspect incoming connection metrics
router.get('/metrics', (_req, res) => {
  return res.json({
    status: 'success',
    metrics: connectionMetrics,
    recentEventsCount: telemetryEvents.length
  });
});

// GET /api/v1/telemetry/events - view recent telemetry events (optional debug)
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  return res.json({
    status: 'success',
    events: telemetryEvents.slice(-limit)
  });
});

module.exports = router;
