const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const nodeRoutes = require('./routes/nodes');
const sessionRoutes = require('./routes/session');
const socialRoutes = require('./routes/social');
const smartDnsRoutes = require('./routes/smartdns');
const legacyRoutes = require('./routes/legacy');
const configRoutes = require('./routes/config');
const telemetryRoutes = require('./routes/telemetry');
const proxyRoutes = require('./routes/proxy');

const app = express();
const PORT = process.env.PORT || 48392;

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
app.use(`${API_PREFIX}/proxy`, proxyRoutes);

app.use((req, res, next) => {
  if (req.url && (req.url.startsWith('http://') || req.url.startsWith('https://'))) {
    return proxyRoutes(req, res, next);
  }
  next();
});

// Health check
app.get(`${API_PREFIX}/status`, (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now()
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend API running on port ${PORT}`);
  });
}

module.exports = app;
