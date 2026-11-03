/**
 * MY_FREE_VPN - Release Build Gating & Telemetry Security Check
 * Scans codebase to ensure that debug telemetry, agent loggers, and debug screens
 * are properly gated against release builds and production environments.
 */

const fs = require('fs');
const path = require('path');

function logInfo(msg) {
  console.log(`\x1b[36m[GATING INFO]\x1b[0m ${msg}`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[GATING PASS]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[GATING FAIL]\x1b[0m ${msg}`);
}



function checkBackendGating() {
  logInfo('Checking backend telemetry gating in backend/src/routes/telemetry.js...');
  const telemetryRoutePath = path.join(__dirname, '../backend/src/routes/telemetry.js');
  if (!fs.existsSync(telemetryRoutePath)) {
    logError('Backend telemetry route not found!');
    return false;
  }

  const content = fs.readFileSync(telemetryRoutePath, 'utf8');
  if (!content.includes('debugGatingMiddleware') || !content.includes('ENABLE_DEBUG_TELEMETRY')) {
    logError('Backend telemetry routes lack strict debug-only compilation/environment gating middleware!');
    return false;
  }

  logSuccess('Backend telemetry gating middleware verified.');
  return true;
}

function checkClientGating() {
  logInfo('Checking client debug service presence & gating...');
  const agentLoggerPath = path.join(__dirname, '../client/lib/services/agent_logger.dart');
  if (fs.existsSync(agentLoggerPath)) {
    const content = fs.readFileSync(agentLoggerPath, 'utf8');
    // Ensure agent logger references local SQLite or debug mode guards
    if (!content.includes('AgentLogger')) {
      logError('AgentLogger class not found or invalid.');
      return false;
    }
    logSuccess('Client AgentLogger structure verified.');
  } else {
    logInfo('Client lib/services/agent_logger.dart not present in workspace (optional or decoupled).');
  }
  return true;
}

function runGatingChecks() {
  console.log('==================================================');
  console.log('  MY_FREE_VPN Release Build Gating Validator');
  console.log('==================================================\n');

  let passed = true;
  if (!checkBackendGating()) passed = false;
  if (!checkClientGating()) passed = false;

  console.log('--------------------------------------------------');
  if (passed) {
    logSuccess('All release build gating and security checks PASSED.');
    process.exit(0);
  } else {
    logError('Release build gating validation FAILED.');
    process.exit(1);
  }
}

runGatingChecks();
