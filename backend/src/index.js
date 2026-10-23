const express = require('express');
const bodyParser = require('body-parser');
const authRoutes = require('./routes/auth');
const nodeRoutes = require('./routes/nodes');
const sessionRoutes = require('./routes/session');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(bodyParser.json());

// API versioning
const API_PREFIX = '/api/v1';

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/nodes`, nodeRoutes);
app.use(`${API_PREFIX}/session`, sessionRoutes);

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
