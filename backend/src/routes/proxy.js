const express = require('express');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const router = express.Router();

function handleProxy(req, res) {
  let targetUrl = req.query.url;

  if (!targetUrl) {
    if (req.url && (req.url.startsWith('http://') || req.url.startsWith('https://'))) {
      targetUrl = req.url;
    } else if (req.originalUrl && (req.originalUrl.startsWith('http://') || req.originalUrl.startsWith('https://'))) {
      targetUrl = req.originalUrl;
    } else {
      const match = req.originalUrl && req.originalUrl.match(/\/api\/v1\/proxy\/(https?:\/\/.+)/i);
      if (match) {
        targetUrl = match[1];
      }
    }
  }

  if (!targetUrl) {
    return res.status(400).json({
      error: 'BAD_REQUEST',
      message: 'Proxy URL missing. Pass ?url=https://example.com or provide an absolute URL request.'
    });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    const lib = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: {
        ...req.headers
      }
    };

    options.headers['host'] = parsedUrl.host;
    delete options.headers['connection'];
    delete options.headers['content-length'];

    const proxyReq = lib.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error('[Proxy Error]:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ error: 'PROXY_ERROR', message: err.message });
      }
    });

    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (err) {
    console.error('[Proxy Parse Error]:', err.message);
    if (!res.headersSent) {
      res.status(400).json({ error: 'INVALID_URL', message: err.message });
    }
  }
}

router.all('/', handleProxy);
router.all('/*', handleProxy);

module.exports = router;
