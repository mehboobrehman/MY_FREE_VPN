const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

function createZip(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve());
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });
  for (let entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

async function run() {
  const newVersion = '1.1.22';
  const newBuild = 22;

  console.log(`Setting up version ${newVersion} (${newBuild}) artifacts...`);

  // Create artifacts directory
  const artifactsDir = 'artifacts';
  fs.mkdirSync(artifactsDir, { recursive: true });

  // Build Extension Debug & Release Zips
  const debugDir = path.join('browser-extension-build', 'debug');
  const releaseDir = path.join('browser-extension-build', 'release');
  
  copyRecursive('browser-extension', debugDir);
  let debugBgPath = path.join(debugDir, 'background.js');
  let debugBg = fs.readFileSync(debugBgPath, 'utf8');
  if (!debugBg.includes('DEBUG_BUILD = true')) {
    debugBg = `const DEBUG_BUILD = true;\n` + debugBg;
  }
  fs.writeFileSync(debugBgPath, debugBg);

  copyRecursive('browser-extension', releaseDir);
  let releaseBgPath = path.join(releaseDir, 'background.js');
  let releaseBg = fs.readFileSync(releaseBgPath, 'utf8');
  if (!releaseBg.includes('DEBUG_BUILD = false')) {
    releaseBg = `const DEBUG_BUILD = false;\n` + releaseBg;
  }
  fs.writeFileSync(releaseBgPath, releaseBg);

  const debugZipName = `MY_FREE_VPN_Browser_Extension_v${newVersion}_debug.zip`;
  const releaseZipName = `MY_FREE_VPN_Browser_Extension_v${newVersion}_release.zip`;

  await createZip(debugDir, debugZipName);
  await createZip(releaseDir, releaseZipName);

  fs.copyFileSync(debugZipName, path.join(artifactsDir, debugZipName));
  fs.copyFileSync(releaseZipName, path.join(artifactsDir, releaseZipName));
  console.log(`Created browser extension zips: ${debugZipName}, ${releaseZipName}`);

  // Copy Android APKs from client build outputs to root and artifacts/
  const srcDebugApk = path.join('client', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
  const srcReleaseApk = path.join('client', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');
  
  const targetDebugApk = `MY_FREE_VPN_v${newVersion}_debug.apk`;
  const targetReleaseApk = `MY_FREE_VPN_v${newVersion}_release.apk`;

  if (fs.existsSync(srcDebugApk)) {
    fs.copyFileSync(srcDebugApk, targetDebugApk);
    fs.copyFileSync(srcDebugApk, path.join(artifactsDir, targetDebugApk));
    console.log(`Copied debug APK to root and artifacts/: ${targetDebugApk}`);
  } else {
    console.error(`Debug APK not found at ${srcDebugApk}`);
  }

  if (fs.existsSync(srcReleaseApk)) {
    fs.copyFileSync(srcReleaseApk, targetReleaseApk);
    fs.copyFileSync(srcReleaseApk, path.join(artifactsDir, targetReleaseApk));
    console.log(`Copied release APK to root and artifacts/: ${targetReleaseApk}`);
  } else {
    console.error(`Release APK not found at ${srcReleaseApk}`);
  }

  // Generate SHA-256 Checksums
  console.log('Generating SHA-256 checksums...');
  const { execSync } = require('child_process');
  execSync('node tools/generate_checksums.js', { stdio: 'inherit' });

  console.log('Artifact building and checksum generation complete for v1.1.22 (build 22)!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
