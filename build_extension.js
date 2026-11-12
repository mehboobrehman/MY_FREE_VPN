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

async function run() {
  const packageJsonPath = path.join(__dirname, 'browser-extension', 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const version = packageJson.version;
  
  // 1. Update manifest.json version
  const manifestPath = path.join('browser-extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Updated manifest.json to version ${version}`);

  // 2. Create debug build directory for extension
  const debugDir = path.join('browser-extension-build', 'debug');
  fs.mkdirSync(debugDir, { recursive: true });
  
  function copyRecursive(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });
    fs.mkdirSync(dest, { recursive: true });
    for (let entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        copyRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  copyRecursive('browser-extension', debugDir);
  
  const debugBgPath = path.join(debugDir, 'background.js');
  let bgContent = fs.readFileSync(debugBgPath, 'utf8');
  bgContent = `const DEBUG_BUILD = true;\n` + bgContent;
  fs.writeFileSync(debugBgPath, bgContent);

  // 3. Create release build directory for extension
  const releaseDir = path.join('browser-extension-build', 'release');
  copyRecursive('browser-extension', releaseDir);
  const releaseBgPath = path.join(releaseDir, 'background.js');
  let releaseBgContent = fs.readFileSync(releaseBgPath, 'utf8');
  releaseBgContent = `const DEBUG_BUILD = false;\n` + releaseBgContent;
  fs.writeFileSync(releaseBgPath, releaseBgContent);

  // 4. Zip outputs for extension
  const artifactsDir = 'artifacts';
  fs.mkdirSync(artifactsDir, { recursive: true });

  const debugZipName = `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`;
  const releaseZipName = `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`;

  await createZip(debugDir, debugZipName);
  await createZip(releaseDir, releaseZipName);

  // Copy zip files to artifacts/ as well
  if (fs.existsSync(debugZipName)) {
    fs.copyFileSync(debugZipName, path.join(artifactsDir, debugZipName));
  }
  if (fs.existsSync(releaseZipName)) {
    fs.copyFileSync(releaseZipName, path.join(artifactsDir, releaseZipName));
  }

  // Also copy APKs to artifacts/ if they exist in root
  const targetDebugApk = `MY_FREE_VPN_v${version}_debug.apk`;
  const targetReleaseApk = `MY_FREE_VPN_v${version}_release.apk`;

  if (fs.existsSync(targetDebugApk)) {
    fs.copyFileSync(targetDebugApk, path.join(artifactsDir, targetDebugApk));
  }
  if (fs.existsSync(targetReleaseApk)) {
    fs.copyFileSync(targetReleaseApk, path.join(artifactsDir, targetReleaseApk));
  }

  console.log(`Successfully created all v${version} dual artifacts:`);
  console.log(`- ${debugZipName}`);
  console.log(`- ${releaseZipName}`);
  console.log(`- ${targetDebugApk}`);
  console.log(`- ${targetReleaseApk}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
