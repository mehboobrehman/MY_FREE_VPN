const fs = require('fs');
const path = require('path');

const version = '1.1.19';
const artifactsDir = 'artifacts';
fs.mkdirSync(artifactsDir, { recursive: true });

const debugApkSrc = path.join('client', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk');
const releaseApkSrc = path.join('client', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk');

const debugApkName = 'MY_FREE_VPN_v' + version + '_debug.apk';
const releaseApkName = 'MY_FREE_VPN_v' + version + '_release.apk';

const debugApkDestRoot = debugApkName;
const releaseApkDestRoot = releaseApkName;
const debugApkDestArtifacts = path.join(artifactsDir, debugApkName);
const releaseApkDestArtifacts = path.join(artifactsDir, releaseApkName);

if (fs.existsSync(debugApkSrc)) {
  fs.copyFileSync(debugApkSrc, debugApkDestRoot);
  fs.copyFileSync(debugApkSrc, debugApkDestArtifacts);
  console.log('Copied debug APK successfully. Size:', fs.statSync(debugApkDestRoot).size);
} else {
  console.error('Debug APK not found at:', debugApkSrc);
  process.exit(1);
}

if (fs.existsSync(releaseApkSrc)) {
  fs.copyFileSync(releaseApkSrc, releaseApkDestRoot);
  fs.copyFileSync(releaseApkSrc, releaseApkDestArtifacts);
  console.log('Copied release APK successfully. Size:', fs.statSync(releaseApkDestRoot).size);
} else {
  console.error('Release APK not found at:', releaseApkSrc);
  process.exit(1);
}
