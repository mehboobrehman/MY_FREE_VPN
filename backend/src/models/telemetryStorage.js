const fs = require('fs');
const path = require('path');

const sessionsDir = path.join(__dirname, '../../data/telemetry_sessions');
const configDir = path.join(__dirname, '../../data/telemetry_config');

function ensureDirs() {
  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
}

const sessionsMetaMap = new Map(); // session_id -> metadata object
const devicesMap = new Map(); // device_id -> device info object

function loadSessionsIndex() {
  ensureDirs();
  try {
    if (!fs.existsSync(sessionsDir)) return;
    const devices = fs.readdirSync(sessionsDir);
    for (const devId of devices) {
      const devPath = path.join(sessionsDir, devId);
      if (fs.statSync(devPath).isDirectory()) {
        const sessionFiles = fs.readdirSync(devPath);
        for (const file of sessionFiles) {
          if (file.endsWith('.jsonl') || file.endsWith('.json')) {
            const sessionId = file.replace(/\.(jsonl|json)$/, '');
            const filePath = path.join(devPath, file);
            const stats = fs.statSync(filePath);
            let eventCount = 0;
            let startTime = stats.birthtimeMs || stats.mtimeMs;
            let endTime = stats.mtimeMs;
            let eventTypes = {};
            let remoteAddress = 'unknown';

            try {
              const content = fs.readFileSync(filePath, 'utf8');
              const lines = content.split('\n').filter(l => l.trim().length > 0);
              eventCount = lines.length;
              if (eventCount > 0) {
                const first = JSON.parse(lines[0]);
                const last = JSON.parse(lines[lines.length - 1]);
                startTime = first.wall_clock_timestamp || first.receivedAt || startTime;
                endTime = last.wall_clock_timestamp || last.receivedAt || endTime;
                remoteAddress = last.remoteAddress || first.remoteAddress || 'unknown';
                for (const line of lines) {
                  const ev = JSON.parse(line);
                  const type = ev.message_type || ev.eventType || ev.type || 'unknown';
                  eventTypes[type] = (eventTypes[type] || 0) + 1;
                }
              }
            } catch (e) {
              // ignore parse errors on partial files
            }

            const sessionMeta = {
              session_id: sessionId,
              device_id: devId,
              start_time: startTime,
              end_time: endTime,
              event_count: eventCount,
              event_types: eventTypes,
              remote_address: remoteAddress,
              file_path: filePath
            };
            sessionsMetaMap.set(sessionId, sessionMeta);

            // Update device info
            const dev = devicesMap.get(devId) || {
              deviceId: devId,
              lastSeenAt: 0,
              lastRemoteAddress: 'unknown',
              sessionCount: 0
            };
            dev.lastSeenAt = Math.max(dev.lastSeenAt, endTime);
            if (remoteAddress !== 'unknown') dev.lastRemoteAddress = remoteAddress;
            devicesMap.set(devId, dev);
          }
        }
        // Update session counts
        const dev = devicesMap.get(devId);
        if (dev) {
          dev.sessionCount = Array.from(sessionsMetaMap.values()).filter(s => s.device_id === devId).length;
        }
      }
    }
  } catch (err) {
    console.error('[TelemetryStorage] Error loading sessions index:', err.message);
  }
}

loadSessionsIndex();

function saveEvent(envelope, remoteAddress = 'unknown') {
  ensureDirs();
  const deviceId = envelope.device_id || 'unknown_device';
  const sessionId = envelope.session_id || 'unknown_session';
  const devDir = path.join(sessionsDir, deviceId);
  if (!fs.existsSync(devDir)) {
    fs.mkdirSync(devDir, { recursive: true });
  }

  const filePath = path.join(devDir, `${sessionId}.jsonl`);
  const record = {
    ...envelope,
    receivedAt: envelope.receivedAt || Date.now(),
    remoteAddress: remoteAddress
  };

  fs.appendFileSync(filePath, JSON.stringify(record) + '\n', 'utf8');

  let meta = sessionsMetaMap.get(sessionId);
  const now = record.wall_clock_timestamp || record.receivedAt;
  const messageType = record.message_type || record.eventType || record.type || 'unknown';

  if (!meta) {
    meta = {
      session_id: sessionId,
      device_id: deviceId,
      start_time: now,
      end_time: now,
      event_count: 1,
      event_types: { [messageType]: 1 },
      remote_address: remoteAddress,
      file_path: filePath
    };
  } else {
    meta.end_time = Math.max(meta.end_time || 0, now);
    meta.event_count = (meta.event_count || 0) + 1;
    meta.event_types[messageType] = (meta.event_types[messageType] || 0) + 1;
    meta.remote_address = remoteAddress;
  }
  sessionsMetaMap.set(sessionId, meta);

  // Update device info
  const dev = devicesMap.get(deviceId) || {
    deviceId: deviceId,
    lastSeenAt: 0,
    lastRemoteAddress: 'unknown',
    sessionCount: 0
  };
  dev.lastSeenAt = Math.max(dev.lastSeenAt, now);
  dev.lastRemoteAddress = remoteAddress;
  dev.sessionCount = Array.from(sessionsMetaMap.values()).filter(s => s.device_id === deviceId).length;
  devicesMap.set(deviceId, dev);

  return record;
}

function recordDiscoveryHit(deviceId, remoteAddress) {
  const now = Date.now();
  console.log(`[Telemetry] Discovery hit from ${remoteAddress}${deviceId ? ` (device: ${deviceId})` : ''}`);
  
  if (deviceId) {
    const dev = devicesMap.get(deviceId) || {
      deviceId: deviceId,
      lastSeenAt: 0,
      lastRemoteAddress: 'unknown',
      sessionCount: 0
    };
    dev.lastSeenAt = Math.max(dev.lastSeenAt, now);
    dev.lastRemoteAddress = remoteAddress;
    devicesMap.set(deviceId, dev);
  }
}

function getDevices() {
  return Array.from(devicesMap.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

function getSessions(query = {}) {
  const result = [];
  for (const meta of sessionsMetaMap.values()) {
    if (query.device_id && meta.device_id !== query.device_id) {
      continue;
    }
    result.push({
      session_id: meta.session_id,
      device_id: meta.device_id,
      start_time: meta.start_time,
      end_time: meta.end_time,
      event_count: meta.event_count,
      event_types: meta.event_types,
      remote_address: meta.remote_address
    });
  }
  result.sort((a, b) => b.start_time - a.start_time);
  return result;
}

function getSessionEvents(sessionId, query = {}) {
  const meta = sessionsMetaMap.get(sessionId);
  if (!meta || !fs.existsSync(meta.file_path)) {
    return null;
  }

  const content = fs.readFileSync(meta.file_path, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  let events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (e) {}
  }

  if (query.type) {
    events = events.filter(e => (e.message_type || e.eventType || e.type) === query.type);
  }
  if (query.level) {
    events = events.filter(e => e.level === query.level || (e.payload && e.payload.level === query.level));
  }
  if (query.tag) {
    events = events.filter(e => e.tag === query.tag || (e.payload && e.payload.tag === query.tag) || (e.tags && e.tags.includes(query.tag)));
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    events = events.filter(e => JSON.stringify(e).toLowerCase().includes(q));
  }

  const limit = parseInt(query.limit, 10) || events.length;
  const offset = parseInt(query.offset, 10) || 0;

  return {
    session_id: sessionId,
    device_id: meta.device_id,
    total_events: events.length,
    events: events.slice(offset, offset + limit)
  };
}

function exportSession(sessionId, format = 'json') {
  const meta = sessionsMetaMap.get(sessionId);
  if (!meta || !fs.existsSync(meta.file_path)) {
    return null;
  }

  const content = fs.readFileSync(meta.file_path, 'utf8');
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const events = [];
  for (const line of lines) {
    try {
      events.push(JSON.parse(line));
    } catch (e) {}
  }

  if (format === 'har') {
    const harEntries = [];
    const customEvents = [];

    for (const ev of events) {
      const type = ev.message_type || ev.eventType || ev.type;
      if (type === 'network' || (ev.payload && ev.payload.url)) {
        const p = ev.payload || ev;
        harEntries.push({
          startedDateTime: new Date(ev.wall_clock_timestamp || ev.receivedAt || Date.now()).toISOString(),
          time: p.duration_ms || 0,
          request: {
            method: p.method || 'GET',
            url: p.url || 'http://localhost/',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: Object.entries(p.request_headers || {}).map(([name, value]) => ({ name, value: String(value) })),
            queryString: [],
            headersSize: -1,
            bodySize: -1
          },
          response: {
            status: p.status_code || 200,
            statusText: p.status_text || 'OK',
            httpVersion: 'HTTP/1.1',
            cookies: [],
            headers: Object.entries(p.response_headers || {}).map(([name, value]) => ({ name, value: String(value) })),
            content: {
              size: p.response_size || (p.body ? JSON.stringify(p.body).length : 0),
              mimeType: p.mime_type || 'application/json',
              text: typeof p.body === 'string' ? p.body : JSON.stringify(p.body || {})
            },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1
          },
          cache: {},
          timings: { send: 0, wait: p.duration_ms || 0, receive: 0 }
        });
      } else {
        customEvents.push(ev);
      }
    }

    return {
      log: {
        version: '1.2',
        creator: { name: 'MY_FREE_VPN Telemetry Viewer', version: '1.1.17' },
        entries: harEntries,
        comment: `Exported session ${sessionId} for device ${meta.device_id}`,
        custom_telemetry_events: customEvents
      }
    };
  } else {
    return {
      session_id: sessionId,
      device_id: meta.device_id,
      exported_at: Date.now(),
      metadata: meta,
      events: events
    };
  }
}

function getConfig(deviceId) {
  ensureDirs();
  const configFile = path.join(configDir, `${deviceId}.json`);
  if (fs.existsSync(configFile)) {
    try {
      return JSON.parse(fs.readFileSync(configFile, 'utf8'));
    } catch (e) {}
  }
  return {
    device_id: deviceId,
    log_level: 'INFO',
    enabled_categories: ['crash', 'anr', 'network', 'performance', 'state_inspection', 'event'],
    sampling_rate: 1.0,
    logpoints: [],
    updated_at: Date.now()
  };
}

function setConfig(deviceId, newConfig) {
  ensureDirs();
  const configFile = path.join(configDir, `${deviceId}.json`);
  const current = getConfig(deviceId);
  const updated = {
    ...current,
    ...newConfig,
    device_id: deviceId,
    updated_at: Date.now()
  };
  fs.writeFileSync(configFile, JSON.stringify(updated, null, 2), 'utf8');
  return updated;
}

module.exports = {
  saveEvent,
  recordDiscoveryHit,
  getDevices,
  getSessions,
  getSessionEvents,
  exportSession,
  getConfig,
  setConfig
};
