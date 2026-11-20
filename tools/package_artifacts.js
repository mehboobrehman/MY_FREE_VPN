const fs = require('fs');
const path = require('path');

const artifactsDir = path.join(__dirname, '..', 'artifacts');
fs.mkdirSync(artifactsDir, { recursive: true });
const versionFile = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const version = versionData.version;

const debugApkSrc = path.join(__dirname, '..', 'client', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
const releaseApkSrc = path.join(__dirname, '..', 'client', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');

if (fs.existsSync(debugApkSrc)) {
  fs.copyFileSync(debugApkSrc, path.join(artifactsDir, `MY_FREE_VPN_v${version}_debug.apk`));
  console.log('Copied debug APK to artifacts/');
} else {
  console.error(`Debug APK not found at ${debugApkSrc}`);
}

if (fs.existsSync(releaseApkSrc)) {
  fs.copyFileSync(releaseApkSrc, path.join(artifactsDir, `MY_FREE_VPN_v${version}_release.apk`));
  console.log('Copied release APK to artifacts/');
} else {
  console.error(`Release APK not found at ${releaseApkSrc}`);
}

const debugZip = `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`;
const releaseZip = `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`;

const rootDebugZip = path.join(__dirname, '..', debugZip);
const rootReleaseZip = path.join(__dirname, '..', releaseZip);

if (fs.existsSync(rootDebugZip)) {
  fs.copyFileSync(rootDebugZip, path.join(artifactsDir, debugZip));
  console.log('Copied debug extension zip to artifacts/');
}
if (fs.existsSync(rootReleaseZip)) {
  fs.copyFileSync(rootReleaseZip, path.join(artifactsDir, releaseZip));
  console.log('Copied release extension zip to artifacts/');
}

console.log('Packaging complete.');
