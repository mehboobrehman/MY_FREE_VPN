const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const VERSION = '1.1.25';
const TAG_NAME = `v${VERSION}`;
const GH_PATH = 'C:\\Users\\mehboob.rehman\\Downloads\\gh_2.102.0_windows_386\\bin\\gh.exe';

function logStep(msg) {
  console.log(`\n\x1b[36m=== ${msg} ===\x1b[0m`);
}

function logSuccess(msg) {
  console.log(`\x1b[32m[SUCCESS]\x1b[0m ${msg}`);
}

function logError(msg) {
  console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`);
}

function run(cmd, retries = 3, delayMs = 2000) {
  console.log(`> ${cmd}`);
  let attempt = 0;
  while (attempt < retries) {
    try {
      attempt++;
      const res = execSync(cmd, { stdio: 'inherit' });
      return res;
    } catch (err) {
      logError(`Command failed on attempt ${attempt}/${retries}: ${cmd}`);
      if (attempt >= retries) {
        throw err;
      }
      console.log(`Retrying in ${delayMs}ms...`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
    }
  }
}

async function runPipeline() {
  try {
    logStep('Step 1: Environment & Prerequisites Check');
    try {
      execSync(`"${GH_PATH}" auth status`, { stdio: 'inherit' });
      logSuccess('GitHub CLI authenticated successfully.');
    } catch (e) {
      logError('GitHub CLI is not authenticated.');
      process.exit(1);
    }

    logStep('Running Test Suite (npm test)');
    execSync('npm test', { stdio: 'inherit' });
    logSuccess('Test suite passed.');

    logStep('Running Release Gating Checks');
    execSync('node tools/check_release_gating.js', { stdio: 'inherit' });
    logSuccess('Release gating checks passed.');

    logStep('Step 2: Clean & Build Process');
    const artifactsDir = path.join(__dirname, '..', 'artifacts');
    if (fs.existsSync(artifactsDir)) {
      console.log('Cleaning existing artifacts/');
      fs.rmSync(artifactsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(artifactsDir, { recursive: true });

    const extBuildDir = path.join(__dirname, '..', 'browser-extension-build');
    if (fs.existsSync(extBuildDir)) {
      console.log('Cleaning existing browser-extension-build/');
      fs.rmSync(extBuildDir, { recursive: true, force: true });
    }

    logStep('Building Browser Extension Dual Artifacts');
    execSync('node build_extension.js', { stdio: 'inherit' });
    logSuccess('Browser extension zips built.');

    logStep('Packaging Android APKs and Extension Zips into artifacts/');
    execSync('node tools/package_artifacts.js', { stdio: 'inherit' });
    logSuccess('Artifacts packaged successfully.');

    logStep('Generating Build Metadata (BUILD_METADATA.json)');
    execSync('node tools/generate_build_metadata.js', { stdio: 'inherit' });
    logSuccess('Build metadata generated.');

    logStep('Generating SHA-256 Cryptographic Checksums (SHA256SUMS)');
    execSync('node tools/generate_checksums.js', { stdio: 'inherit' });
    logSuccess('Checksums generated.');

    logStep('Step 3: Git Operations & Publishing');
    run('git add .');
    try {
      run(`git commit -m "chore(release): publish version ${TAG_NAME} with dual debug/release artifacts"`);
    } catch (e) {
      console.log('No changes to commit or commit already made.');
    }

    logStep('Pushing to origin main with retry logic');
    run('git push origin main');
    logSuccess('Pushed to origin main.');

    logStep('Tagging and Pushing Tag');
    try {
      execSync(`git tag -d ${TAG_NAME}`);
    } catch (e) {}
    try {
      execSync(`git push origin :refs/tags/${TAG_NAME}`);
    } catch (e) {}

    run(`git tag -a ${TAG_NAME} -m "Release ${TAG_NAME} for MY_FREE_VPN"`);
    run(`git push origin ${TAG_NAME} --force`);
    logSuccess(`Tag ${TAG_NAME} pushed successfully.`);

    logStep('Creating GitHub Release & Uploading Artifacts');
    try {
      run(`"${GH_PATH}" release delete ${TAG_NAME} --yes`);
      console.log('Deleted existing GitHub release for clobber.');
    } catch (e) {
      console.log('No existing release to delete.');
    }

    const releaseNotes = `Release ${TAG_NAME} for MY_FREE_VPN.
Includes dual debug and release production artifacts:
- Android APK Debug: \`MY_FREE_VPN_v${VERSION}_debug.apk\`
- Android APK Release: \`MY_FREE_VPN_v${VERSION}_release.apk\`
- Browser Extension Zip Debug: \`MY_FREE_VPN_Browser_Extension_v${VERSION}_debug.zip\`
- Browser Extension Zip Release: \`MY_FREE_VPN_Browser_Extension_v${VERSION}_release.zip\`
- Build Metadata: \`BUILD_METADATA.json\`
- Checksums: \`SHA256SUMS\`
- Architecture: Zero-Setup VPN with Live Debug Telemetry & RAM-Only Ephemeral Exit Nodes.`;

    const notesFile = 'release_notes_temp.md';
    fs.writeFileSync(notesFile, releaseNotes, 'utf8');

    run(`"${GH_PATH}" release create ${TAG_NAME} --title "Release ${TAG_NAME}" --notes-file ${notesFile}`);

    if (fs.existsSync(notesFile)) {
      fs.unlinkSync(notesFile);
    }

    const artifactsToUpload = [
      `MY_FREE_VPN_v${VERSION}_debug.apk`,
      `MY_FREE_VPN_v${VERSION}_release.apk`,
      `MY_FREE_VPN_Browser_Extension_v${VERSION}_debug.zip`,
      `MY_FREE_VPN_Browser_Extension_v${VERSION}_release.zip`,
      'BUILD_METADATA.json',
      'SHA256SUMS'
    ];

    for (const art of artifactsToUpload) {
      const artPath = path.join(artifactsDir, art);
      if (fs.existsSync(artPath)) {
        console.log(`Uploading ${art} to release ${TAG_NAME}...`);
        run(`"${GH_PATH}" release upload ${TAG_NAME} "${artPath}" --clobber`);
      } else {
        logError(`Artifact not found for upload: ${artPath}`);
        process.exit(1);
      }
    }

    logSuccess(`Pipeline completed successfully for version ${VERSION}!`);
  } catch (err) {
    logError(`Pipeline failed: ${err.message}`);
    process.exit(1);
  }
}

runPipeline();
