/**
 * MY_FREE_VPN - Live Debug Telemetry Developer CLI Tool
 * Automates:
 * 1. Prerequisite checks & auto-starting the Telemetry Server (backend/src/index.js on port 48392)
 * 2. Device selection & ADB port forwarding (adb forward tcp:48392 tcp:48392)
 * 3. Endpoint discovery (Local Wi-Fi IP & Cloud Relay fallback)
 * 4. Launching the Developer Viewer Dashboard (http://localhost:48392/viewer)
 * 5. Installing & launching debug app on connected ADB device (artifacts/MY_FREE_VPN_v1.1.18_debug.apk or fallback)
 * 6. Test telemetry verification payload ingestion & live metrics streaming
 */

const { execSync, spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

function parseArgs() {
  const args = process.argv.slice(2);
  let port = process.env.PORT || 48392;
  const portIdx = args.indexOf('--port');
  if (portIdx !== -1 && args[portIdx + 1]) {
    port = parseInt(args[portIdx + 1], 10);
  }
  const isAll = args.includes('--all') || args.includes('--auto-start');
  const skipAdb = args.includes('--no-adb');
  const skipBackend = args.includes('--no-backend');
  const openViewerFlag = args.includes('--open-viewer') || isAll;
  return { args, port, isAll, skipAdb, skipBackend, openViewerFlag };
}

const { port: BACKEND_PORT, isAll, skipAdb, skipBackend, openViewerFlag } = parseArgs();
const BACKEND_URL = process.env.BACKEND_URL || `http://localhost:${BACKEND_PORT}`;

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
  return '127.0.0.1';
}

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

async function checkUrl(url) {
  return new Promise((resolve) => {
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

async function checkBackend(url = BACKEND_URL) {
  const statusOk = await checkUrl(`${url}/api/v1/status`);
  if (statusOk) return true;
  return checkUrl(`${url}/api/v1/health`);
}

async function spawnBackendIfNeeded(backendUrl, port) {
  const isRunning = await checkBackend(backendUrl);
  if (isRunning) {
    logSuccess(`Backend is already running at ${backendUrl}`);
    return true;
  }

  logInfo(`Backend is not running. Auto-starting backend server on port ${port}...`);
  const backendEntry = path.resolve(__dirname, '../backend/src/index.js');
  if (!fs.existsSync(backendEntry)) {
    logError(`Backend entry file not found at ${backendEntry}`);
    return false;
  }

  const env = Object.assign({}, process.env, { PORT: String(port) });
  const child = spawn(process.execPath, [backendEntry], {
    cwd: path.resolve(__dirname, '../backend'),
    env,
    detached: true,
    stdio: 'ignore'
  });
  child.unref();

  logInfo('Waiting for backend server to initialize...');
  const startTime = Date.now();
  const maxWaitMs = 15000;
  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 500));
    const healthy = await checkBackend(backendUrl);
    if (healthy) {
      logSuccess(`Backend server successfully started and responding at ${backendUrl}`);
      return true;
    }
  }

  logError(`Timed out waiting for backend server at ${backendUrl}`);
  return false;
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

function findDebugApk() {
  const candidates = [
    path.resolve(__dirname, '../artifacts/MY_FREE_VPN_v1.1.18_debug.apk'),
    path.resolve(__dirname, '../client/build/app/outputs/flutter-apk/app-debug.apk')
  ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }

  // Check artifacts dir for any debug apk
  const artifactsDir = path.resolve(__dirname, '../artifacts');
  if (fs.existsSync(artifactsDir)) {
    const files = fs.readdirSync(artifactsDir);
    const debugApk = files.find(f => f.includes('debug') && f.endsWith('.apk'));
    if (debugApk) {
      return path.join(artifactsDir, debugApk);
    }
  }

  return null;
}

function installAndLaunchApp(deviceSerial) {
  const apkPath = findDebugApk();
  if (!apkPath) {
    logWarn('Debug APK not found in artifacts/ or client/build/. Skipping installation.');
    return false;
  }

  const serialArg = deviceSerial ? `-s ${deviceSerial}` : '';
  logInfo(`Installing debug APK (${apkPath}) via adb install -r...`);
  try {
    execSync(`adb ${serialArg} install -r "${apkPath}"`, { stdio: 'inherit', encoding: 'utf8' });
    logSuccess('Debug APK successfully installed.');
  } catch (err) {
    logWarn(`ADB install warning/error: ${err.message}`);
  }

  logInfo('Launching debug application on device...');
  const activities = [
    'com.myfreevpn.client/.MainActivity',
    'com.myfreevpn.client/com.myfreevpn.client.MainActivity'
  ];

  let launched = false;
  for (const act of activities) {
    try {
      execSync(`adb ${serialArg} shell am start -n ${act}`, { stdio: 'ignore', encoding: 'utf8' });
      logSuccess(`Application launched successfully via activity: ${act}`);
      launched = true;
      break;
    } catch (e) {
      // try next activity
    }
  }

  if (!launched) {
    try {
      execSync(`adb ${serialArg} shell monkey -p com.myfreevpn.client -c android.intent.category.LAUNCHER 1`, { stdio: 'ignore', encoding: 'utf8' });
      logSuccess('Application launched via monkey fallback command.');
      launched = true;
    } catch (e) {
      logWarn('Could not launch app automatically via am start or monkey. Please open manually.');
    }
  }

  return launched;
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

async function sendTestTelemetryEvent(backendUrl) {
  const payload = JSON.stringify({
    schema_version: '1.0.0',
    session_id: 'session-live-debug-' + Date.now(),
    device_id: 'device-verify-cli',
    sequence_number: 1,
    monotonic_timestamp: 100.0,
    wall_clock_timestamp: Date.now(),
    message_type: 'vpn_connect',
    payload: {
      event_type: 'vpn_connect',
      nodeId: 'node-live-debug-verifier',
      status: 'pipeline_verified',
      source: 'live_debug_cli'
    }
  });

  return new Promise((resolve) => {
    const url = new URL(`${backendUrl}/api/v1/telemetry/events`);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          logSuccess('Test telemetry verification payload ingested successfully!');
          resolve(true);
        } else {
          logWarn(`Telemetry ingestion returned HTTP ${res.statusCode}: ${data}`);
          resolve(false);
        }
      });
    });
    req.on('error', (err) => {
      logWarn(`Failed to send test telemetry event: ${err.message}`);
      resolve(false);
    });
    req.write(payload);
    req.end();
  });
}

async function fetchMetrics(backendUrl) {
  return new Promise((resolve) => {
    const url = `${backendUrl}/api/v1/telemetry/metrics`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

function openViewer(port = BACKEND_PORT) {
  const viewerUrl = `http://localhost:${port}/viewer`;
  logInfo(`Opening Developer Viewer dashboard (${viewerUrl})...`);
  const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    execSync(`${startCmd} "${viewerUrl}"`, { stdio: 'ignore' });
    logSuccess('Developer Viewer opened in default browser.');
  } catch (err) {
    logWarn(`Could not auto-open browser: ${err.message}`);
    const viewerPath = path.resolve(__dirname, '../developer-viewer/index.html');
    logInfo(`You can manually open: file://${viewerPath} or ${viewerUrl}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
MY_FREE_VPN Live Debug Telemetry CLI Tool
Usage: node tools/live_debug.js [options]

Options:
  --all           Run full 4-step Live Debug pipeline (auto-start backend, ADB setup, install/launch APK, open viewer, verify telemetry)
  --auto-start    Alias for --all
  --no-adb        Skip ADB device detection, port forwarding, and APK installation/launch
  --no-backend    Skip backend liveness check and auto-start
  --open-viewer   Automatically open developer viewer HTML dashboard
  --port <port>   Specify backend port (default: ${BACKEND_PORT})
  --help, -h      Show this help message
    `);
    process.exit(0);
  }

  console.log('==================================================');
  console.log('  MY_FREE_VPN Live Debug Telemetry Initializer');
  console.log('==================================================\n');

  // Step 1: Backend Check & Auto-Start
  logInfo('Step 1: Telemetry Backend Server check & initialization...');
  let backendRunning = false;
  if (!skipBackend) {
    if (isAll) {
      backendRunning = await spawnBackendIfNeeded(BACKEND_URL, BACKEND_PORT);
    } else {
      backendRunning = await checkBackend(BACKEND_URL);
      if (backendRunning) {
        logSuccess(`Backend is running at ${BACKEND_URL}`);
      } else {
        logWarn(`Backend is NOT running at ${BACKEND_URL}.`);
        logInfo('Pass --all to auto-start backend, or run: cd backend && npm start');
      }
    }
  } else {
    logInfo('Step 1: Bypassing backend check (--no-backend).');
  }

  // Step 2: ADB Device Detection & Port Forwarding
  let devices = [];
  if (!skipAdb) {
    logInfo('Step 2: Checking connected ADB devices & setting up port forwarding...');
    devices = checkAdb();
    if (devices.length > 0) {
      logSuccess(`Found ${devices.length} connected ADB device(s): ${devices.join(', ')}`);
      const targetDevice = devices[0];
      logInfo(`Selecting device: ${targetDevice}`);
      setupAdbForward(targetDevice, BACKEND_PORT);
    } else {
      logWarn('No ADB devices connected. Running in network/cloud mode or emulator.');
    }
  } else {
    logInfo('Step 2: Bypassing ADB setup (--no-adb).');
  }

  // Step 3: Launch Developer Viewer Dashboard
  logInfo('Step 3: Developer Viewer Dashboard...');
  if (openViewerFlag) {
    openViewer(BACKEND_PORT);
  } else {
    logInfo(`Developer Viewer accessible at ${BACKEND_URL}/viewer`);
  }

  // Step 4: App Installation & Launch, Test Telemetry Verification, and Live Status
  logInfo('Step 4: App Deployment, Telemetry Verification & Live Streaming...');
  if (!skipAdb && devices.length > 0) {
    const targetDevice = devices[0];
    installAndLaunchApp(targetDevice);
  } else if (!skipAdb) {
    logWarn('Skipping debug APK installation & launch (no connected ADB devices).');
  }

  // Endpoint Discovery
  if (backendRunning) {
    const discovery = await discoverEndpoints();
    if (discovery && discovery.discovery) {
      logSuccess('Endpoint discovery successful:');
      console.log(JSON.stringify(discovery.discovery, null, 2));
    }
  }

  // Send Test Telemetry Verification Event
  if (backendRunning) {
    logInfo('Sending test telemetry verification event to confirm pipeline liveness...');
    await sendTestTelemetryEvent(BACKEND_URL);

    // Display live metrics summary
    const metrics = await fetchMetrics(BACKEND_URL);
    if (metrics) {
      logSuccess('Live Telemetry Pipeline Status & Metrics:');
      console.log(JSON.stringify(metrics, null, 2));
    }
  }

  const lanIp = getLocalLanIp();
  const sampleDeviceId = 'device-' + Math.floor(Math.random() * 100000);
  const sampleSessionId = 'session-' + Date.now();
  console.log('\n--------------------------------------------------');
  console.log(`  Local LAN IPv4    : ${lanIp}`);
  console.log(`  Developer Viewer  : ${BACKEND_URL}/viewer`);
  console.log(`  Sample Device ID  : ${sampleDeviceId}`);
  console.log(`  Sample Session ID : ${sampleSessionId}`);
  console.log(`  Auth Header       : Bearer freevpn_debug_token_xyz`);
  console.log('--------------------------------------------------\n');

  logSuccess('Live Debug Telemetry single-point execution pipeline completed successfully!');
}

main().catch(err => {
  logError(`Fatal error: ${err.message}`);
  process.exit(1);
});
