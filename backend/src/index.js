const express = require('express');
const bodyParser = require('body-parser');
const http = require('http');
const dgram = require('dgram');
const path = require('path');
const authRoutes = require('./routes/auth');
const nodeRoutes = require('./routes/nodes');
const sessionRoutes = require('./routes/session');
const socialRoutes = require('./routes/social');
const smartDnsRoutes = require('./routes/smartdns');
const legacyRoutes = require('./routes/legacy');
const configRoutes = require('./routes/config');
const telemetryRoutes = require('./routes/telemetry');
const adminAuthMiddleware = require('./middleware/adminAuth');

const app = express();
const PORT = process.env.PORT || 48392;
const UDP_PORT = process.env.UDP_PORT || 51820;

app.use(bodyParser.json());

// API versioning
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/nodes`, nodeRoutes);
app.use(`${API_PREFIX}/session`, sessionRoutes);
app.use(`${API_PREFIX}/social`, socialRoutes);
app.use(`${API_PREFIX}/smartdns`, smartDnsRoutes);
app.use(`${API_PREFIX}/legacy`, legacyRoutes);
app.use(`${API_PREFIX}/config`, configRoutes);
app.use(`${API_PREFIX}/telemetry`, telemetryRoutes);

// Developer Viewer Dashboard static assets
app.use('/viewer', adminAuthMiddleware, express.static(path.join(__dirname, '../../developer-viewer')));
app.get('/api/v1/telemetry/viewer', adminAuthMiddleware, (_req, res) => res.redirect('/viewer/'));

// Health check
app.get([`${API_PREFIX}/status`, `${API_PREFIX}/health`], (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now()
  });
});

// Create HTTP Server
const server = http.createServer(app);

// UDP Server for Mobile App (WireGuard Tunnel Protocol)
const udpServer = dgram.createSocket('udp4');

udpServer.on('error', (err) => {
  if (err.code !== 'EADDRINUSE') {
    console.error(`[UDP Server Error]: ${err.stack}`);
  }
});

udpServer.on('message', (msg, rinfo) => {
  if (msg.length === 0) return;
  const msgType = msg[0];

  let responseBuf;
  if (msgType === 0x01) {
    // Handshake Initiation (Type 1) -> Handshake Response (Type 2)
    responseBuf = Buffer.alloc(92);
    responseBuf[0] = 0x02;
    if (msg.length >= 8) {
      msg.copy(responseBuf, 4, 4, 8);
    }
    console.log('[UDP VPN] Handshake initiation received, sent Handshake Response.');
  } else if (msgType === 0x04) {
    // Keepalive / Transport Data (Type 4) -> Keepalive ACK
    responseBuf = Buffer.alloc(Math.max(32, msg.length));
    responseBuf[0] = 0x04;
    msg.copy(responseBuf, 4, 4, Math.min(msg.length, responseBuf.length));
    console.log('[UDP VPN] Keepalive received, sent keepalive ACK.');
  } else {
    // Data packet -> Echo as transport data packet
    responseBuf = Buffer.alloc(msg.length);
    msg.copy(responseBuf);
    responseBuf[0] = 0x04;
    console.log(`[UDP VPN] Data packet of length ${msg.length} received, echoing response.`);
  }

  udpServer.send(responseBuf, rinfo.port, rinfo.address, (err) => {
    if (err) {
      console.error('[UDP VPN] Error sending response:', err);
    }
  });
});

try {
  udpServer.bind(UDP_PORT, () => {
    console.log(`[UDP VPN] WireGuard UDP tunnel server listening on port ${UDP_PORT}`);
  });
} catch (err) {
  if (err.code !== 'EADDRINUSE') {
    console.error('[UDP VPN] Bind error:', err);
  }
}

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
  });
}

module.exports = app;