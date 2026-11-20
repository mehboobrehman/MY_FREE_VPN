const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const versionFile = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const version = versionData.version;

let gitHash = 'unknown';
let gitBranch = 'main';
let commitAuthor = 'unknown';

try {
  gitHash = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  gitBranch = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  commitAuthor = execSync('git log -1 --format="%an <%ae>"', { encoding: 'utf8' }).trim();
} catch (e) {
  console.warn('Warning: Could not retrieve full git metadata:', e.message);
}

const artifactsDir = path.join(__dirname, '..', 'artifacts');
const artifacts = [];

if (fs.existsSync(artifactsDir)) {
  const files = fs.readdirNames ? fs.readdirSync(artifactsDir) : fs.readdirSync(artifactsDir);
  for (const file of files) {
    const filePath = path.join(artifactsDir, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      artifacts.push({
        name: file,
        sizeBytes: stat.size,
        createdAt: stat.birthtime
      });
    }
  }
}

const metadata = {
  projectName: 'MY_FREE_VPN',
  version: version,
  buildTimestamp: new Date().toISOString(),
  git: {
    commitHash: gitHash,
    branch: gitBranch,
    author: commitAuthor
  },
  artifactsPolicy: 'Dual Artifacts (Debug vs Release)',
  artifacts: artifacts
};

const metadataPath = path.join(artifactsDir, 'BUILD_METADATA.json');
fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');
console.log(`Generated build metadata at ${metadataPath}:`);
console.log(JSON.stringify(metadata, null, 2));
