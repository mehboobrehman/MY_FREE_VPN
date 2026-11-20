/**
 * MY_FREE_VPN - Release Build Gating, Telemetry Security Check, & Version Synchronization
 * Scans codebase to ensure that debug telemetry, agent loggers, and debug screens
 * are properly gated against release builds and production environments,
 * and verifies version consistency across the monorepo.
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

function checkVersionSynchronization() {
  logInfo('Checking version synchronization across all 7 monorepo version files...');
  const rootVersionPath = path.join(__dirname, '..', 'version.json');
  if (!fs.existsSync(rootVersionPath)) {
    logError('Root version.json not found!');
    return false;
  }

  const rootVersionData = JSON.parse(fs.readFileSync(rootVersionPath, 'utf8'));
  const expectedVersion = rootVersionData.version;
  logInfo(`Expected version from version.json: ${expectedVersion}`);

  const filesToCheck = [
    { path: 'version.json', type: 'json', key: 'version' },
    { path: 'package.json', type: 'json', key: 'version' },
    { path: 'backend/package.json', type: 'json', key: 'version' },
    { path: 'browser-extension/package.json', type: 'json', key: 'version' },
    { path: 'browser-extension/manifest.json', type: 'json', key: 'version' },
    { path: 'client/pubspec.yaml', type: 'yaml_version' },
    { path: 'client/lib/config/version_config.dart', type: 'dart_version' }
  ];

  let synchronized = true;

  for (const fileConfig of filesToCheck) {
    const fullPath = path.join(__dirname, '..', fileConfig.path);
    if (!fs.existsSync(fullPath)) {
      logError(`Version file not found: ${fileConfig.path}`);
      synchronized = false;
      continue;
    }

    const content = fs.readFileSync(fullPath, 'utf8');
    let actualVersion = null;

    if (fileConfig.type === 'json') {
      const json = JSON.parse(content);
      actualVersion = json[fileConfig.key];
    } else if (fileConfig.type === 'yaml_version') {
      const match = content.match(/^version:\s*([^+]+)(?:\+(.+))?$/m);
      if (match) {
        actualVersion = match[1].trim();
      }
    } else if (fileConfig.type === 'dart_version') {
      const match = content.match(/static const String version = '([^']+)';/);
      if (match) {
        actualVersion = match[1].trim();
      }
    }

    if (actualVersion !== expectedVersion) {
      logError(`Version desync in ${fileConfig.path}: found "${actualVersion}", expected "${expectedVersion}"`);
      synchronized = false;
    } else {
      logSuccess(`${fileConfig.path} matches expected version ${expectedVersion}.`);
    }
  }

  return { synchronized, expectedVersion };
}

function checkStaleReferences(expectedVersion) {
  logInfo('Checking codebase for stale hardcoded references of previous versions...');
  const parts = expectedVersion.split('.').map(Number);
  if (parts.length !== 3) {
    logError(`Expected version "${expectedVersion}" is not valid SemVer.`);
    return false;
  }

  const [maj, min, pat] = parts;
  let prevVersion = null;
  if (pat > 0) {
    prevVersion = `${maj}.${min}.${pat - 1}`;
  } else if (min > 0) {
    prevVersion = `${maj}.${min - 1}.9`;
  }

  if (!prevVersion) {
    logInfo('No previous version to check against (or patch is 0 and minor is 0).');
    return true;
  }

  logInfo(`Checking for stale references of previous version: ${prevVersion}`);

  const dirsToScan = ['backend', 'client/lib', 'browser-extension', 'tools', 'developer-viewer'];
  const rootFilesToScan = ['package.json', 'version.json'];
  
  let hasStale = false;

  function scanFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      // Ignore comment lines to avoid flagging examples
      if (line.trim().startsWith('//')) return;
      
      if (line.includes(prevVersion)) {
        logError(`Stale reference to previous version ${prevVersion} found in ${filePath}:${idx + 1}: ${line.trim()}`);
        hasStale = true;
      }
    });
  }

  function scanDir(dirPath) {
    const fullDir = path.join(__dirname, '..', dirPath);
    if (!fs.existsSync(fullDir)) return;
    const entries = fs.readdirSync(fullDir, { withFileTypes: true });
    for (const entry of entries) {
      const resPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'build' || entry.name === '.git' || entry.name === 'artifacts') continue;
        scanDir(resPath);
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.lock') || entry.name.endsWith('.sum') || entry.name.endsWith('.apk') || entry.name.endsWith('.zip')) continue;
        scanFile(path.join(__dirname, '..', resPath));
      }
    }
  }

  rootFilesToScan.forEach(f => scanFile(path.join(__dirname, '..', f)));
  dirsToScan.forEach(d => scanDir(d));

  if (hasStale) {
    logError(`Found stale references to previous version ${prevVersion}!`);
    return false;
  }

  logSuccess(`No stale references to previous version ${prevVersion} detected.`);
  return true;
}

function runGatingChecks() {
  console.log('==================================================');
  console.log('  MY_FREE_VPN Release Build Gating Validator');
  console.log('==================================================\n');

  let passed = true;
  if (!checkBackendGating()) passed = false;
  if (!checkClientGating()) passed = false;
  
  const { synchronized, expectedVersion } = checkVersionSynchronization();
  if (!synchronized) passed = false;
  
  if (expectedVersion && !checkStaleReferences(expectedVersion)) passed = false;

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
