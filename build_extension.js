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
  const version = '1.1.15';
  
  // Update manifest.json version
  const manifestPath = path.join('browser-extension', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`Updated manifest.json to version ${version}`);

  // Create debug build directory
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

  // Create release build directory
  const releaseDir = path.join('browser-extension-build', 'release');
  copyRecursive('browser-extension', releaseDir);
  const releaseBgPath = path.join(releaseDir, 'background.js');
  let releaseBgContent = fs.readFileSync(releaseBgPath, 'utf8');
  releaseBgContent = `const DEBUG_BUILD = false;\n` + releaseBgContent;
  fs.writeFileSync(releaseBgPath, releaseBgContent);

  // Zip outputs
  const debugZip = `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`;
  const releaseZip = `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`;

  await createZip(debugDir, debugZip);
  await createZip(releaseDir, releaseZip);

  console.log(`Successfully created:`);
  console.log(`- ${debugZip}`);
  console.log(`- ${releaseZip}`);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
