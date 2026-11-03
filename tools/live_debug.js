/**
 * MY_FREE_VPN - Live Debug Telemetry Developer CLI Tool
 * Automates:
 * 1. Prerequisite checks (Node.js, adb, backend status)
 * 2. Device selection (ADB connected Android devices)
 * 3. Endpoint discovery (Local Wi-Fi IP & Cloud Relay fallback)
 * 4. Port forwarding / tunnel setup (adb forward)
 * 5. Collector status & verification
 * 6. Viewer opening (developer-viewer/index.html dashboard)
 * 7. Credential & auth token printing
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const BACKEND_PORT = process.env.PORT || 3000;
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${BACKEND_PORT}`;

function logInfo(msg) {
  console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`\x1b[33m[WARN]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
}

async function checkBackend() {
  return new Promise((resolve) => {
    const url = `${BACKEND_URL}/api/v1/health`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          resolve(false);
        }
      });
    }).on('error', () => {
      resolve(false);
    });
  });
}

function checkAdb() {
  try {
    const output = execSync('adb devices', { encoding: 'utf8' });
    const lines = output.split('\n').filter(l => l.trim().length > 0 && !l.startsWith('List'));
    const devices = lines.map(l => l.split('\t')[0]).filter(Boolean);
    return devices;
  } catch (err) {
    return [];
  }
}

async function discoverEndpoints() {
  return new Promise((resolve) => {
    const url = `${BACKEND_URL}/api/v1/telemetry/discovery`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

function setupAdbForward(deviceSerial, port = BACKEND_PORT) {
  try {
    const serialArg = deviceSerial ? `-s ${deviceSerial}` : '';
    execSync(`adb ${serialArg} forward tcp:${port} tcp:${port}`, { encoding: 'utf8' });
    logSuccess(`ADB port forwarding established: tcp:${port} -> tcp:${port} ${deviceSerial ? `(Device: ${deviceSerial})` : ''}`);
    return true;
  } catch (err) {
    logWarn(`Could not setup ADB port forwarding: ${err.message}`);
    return false;
  }
}

function openViewer() {
  const viewerPath = path.resolve(__dirname, '../developer-viewer/index.html');
  if (!fs.existsSync(viewerPath)) {
    logError(`Developer viewer not found at ${viewerPath}`);
    return;
  }

  logInfo(`Opening Developer Viewer dashboard (${viewerPath})...`);
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    execSync(`${startCmd} "${viewerPath}"`, { stdio: 'ignore' });
    logSuccess('Developer Viewer opened in default browser.');
  } catch (err) {
    logWarn(`Could not auto-open browser: ${err.message}`);
    logInfo(`You can manually open: file://${viewerPath}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MY_FREE_VPN Live Debug Telemetry CLI Tool
Usage: node tools/live_debug.js [options]

Options:
  --no-adb        Skip ADB device detection and port forwarding
  --no-backend    Skip backend liveness check
  --open-viewer   Automatically open developer viewer HTML dashboard
  --port <port>   Specify backend port (default: ${BACKEND_PORT})
  --help, -h      Show this help message
    `);
    process.exit(0);
  }

  console.log('==================================================');
  console.log('  MY_FREE_VPN Live Debug Telemetry Initializer');
  console.log('==================================================\n');

  // 1. Prerequisite checks
  logInfo('Step 1: Running prerequisite checks...');
  logInfo(`Node.js Version: ${process.version}`);

  const skipBackend = args.includes('--no-backend');
  let backendRunning = false;
  if (!skipBackend) {
    backendRunning = await checkBackend();
    if (backendRunning) {
      logSuccess(`Backend is running at ${BACKEND_URL}`);
    } else {
      logWarn(`Backend is NOT running at ${BACKEND_URL}.`);
      logInfo('Please start backend with: cd backend && npm start');
    }
  }

  // 2. Device selection & ADB setup
  const skipAdb = args.includes('--no-adb');
  let devices = [];
  if (!skipAdb) {
    logInfo('Step 2: Checking connected ADB devices...');
    devices = checkAdb();
    if (devices.length > 0) {
      logSuccess(`Found ${devices.length} connected ADB device(s): ${devices.join(', ')}`);
      const targetDevice = devices[0];
      logInfo(`Selecting device: ${targetDevice}`);

      // 3. Port forwarding setup
      logInfo('Step 3: Setting up port forwarding...');
      setupAdbForward(targetDevice, BACKEND_PORT);
    } else {
      logWarn('No ADB devices connected. Running in network/cloud mode or emulator.');
    }
  }

  // 4. Endpoint discovery
  logInfo('Step 4: Discovering telemetry endpoints...');
  if (backendRunning) {
    const discovery = await discoverEndpoints();
    if (discovery && discovery.discovery) {
      logSuccess('Endpoint discovery successful:');
      console.log(JSON.stringify(discovery.discovery, null, 2));
    } else {
      logWarn('Endpoint discovery API returned invalid response or endpoint unreachable.');
    }
  } else {
    logInfo('Skipping endpoint discovery because backend is offline.');
  }

  // 5. Credentials & Test Command Printing
  logInfo('Step 5: Active Debug Credentials & Test Ingestion Commands');
  const sampleDeviceId = 'device-' + Math.floor(Math.random() * 100000);
  const sampleSessionId = 'session-' + Date.now();
  console.log('--------------------------------------------------');
  console.log(`  Sample Device ID  : ${sampleDeviceId}`);
  console.log(`  Sample Session ID : ${sampleSessionId}`);
  console.log(`  Auth Header       : Bearer freevpn_debug_token_xyz`);
  console.log('--------------------------------------------------');
  console.log('Test Event Ingestion (cURL):');
  console.log(`curl -X POST ${BACKEND_URL}/api/v1/telemetry/events \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '{"schema_version":"1.0.0","session_id":"${sampleSessionId}","device_id":"${sampleDeviceId}","sequence_number":1,"monotonic_timestamp":100.0,"wall_clock_timestamp":${Date.now()},"message_type":"vpn_connect","payload":{"event_type":"vpn_connect","nodeId":"node-sg-01"}}'`);
  console.log('--------------------------------------------------\n');

  // 6. Open Viewer
  if (args.includes('--open-viewer')) {
    openViewer();
  } else {
    logInfo('Tip: Run with --open-viewer to automatically launch the Live Debug Viewer dashboard.');
  }

  logSuccess('Live Debug Telemetry environment ready!');
}

main().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
