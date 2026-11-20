const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ghPath = 'C:\\Users\\mehboob.rehman\\Downloads\\gh_2.102.0_windows_386\\bin\\gh.exe';
const versionFile = path.join(__dirname, '..', 'version.json');
const versionData = JSON.parse(fs.readFileSync(versionFile, 'utf8'));
const version = versionData.version;
const tagName = `v${version}`;

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    const res = execSync(cmd, { stdio: 'inherit' });
    return res;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    throw err;
  }
}

console.log('1. Cleaning up existing release if any...');
try {
  run(`"${ghPath}" release delete ${tagName} --yes`);
} catch (e) {
  console.log('No existing release to delete.');
}

console.log('2. Creating GitHub Release...');
const releaseNotes = `Release ${tagName} for MY_FREE_VPN.
Includes dual debug and release artifacts:
- Android APK Debug: \`MY_FREE_VPN_v${version}_debug.apk\`
- Android APK Release: \`MY_FREE_VPN_v${version}_release.apk\`
- Browser Extension Zip Debug: \`MY_FREE_VPN_Browser_Extension_v${version}_debug.zip\`
- Browser Extension Zip Release: \`MY_FREE_VPN_Browser_Extension_v${version}_release.zip\`
- Checksums: \`SHA256SUMS\`
- Live Debug Telemetry & Zero-Setup architecture enabled.`;

const notesFile = 'release_notes_temp.md';
fs.writeFileSync(notesFile, releaseNotes);

run(`"${ghPath}" release create ${tagName} --title "Release ${tagName}" --notes-file ${notesFile}`);

if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

console.log('3. Uploading artifacts...');
const artifacts = [
  path.join('artifacts', `MY_FREE_VPN_v${version}_debug.apk`),
  path.join('artifacts', `MY_FREE_VPN_v${version}_release.apk`),
  path.join('artifacts', `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`),
  path.join('artifacts', `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`),
  path.join('artifacts', 'SHA256SUMS')
];

for (const artifact of artifacts) {
  if (fs.existsSync(artifact)) {
    console.log(`Uploading ${artifact}...`);
    run(`"${ghPath}" release upload ${tagName} "${artifact}" --clobber`);
  } else {
    console.error(`Artifact not found: ${artifact}`);
  }
}

console.log('Release process finished successfully!');
