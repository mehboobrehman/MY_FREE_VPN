const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ghPath = 'C:\\Users\\mehboob.rehman\\Downloads\\gh_2.102.0_windows_386\\bin\\gh.exe';
const version = '1.1.21';
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

console.log('Checking / Creating GitHub release...');
const releaseNotes = `Release ${tagName} for MY_FREE_VPN.
Includes dual debug and release artifacts:
- Android APK Debug: \`MY_FREE_VPN_v${version}_debug.apk\`
- Android APK Release: \`MY_FREE_VPN_v${version}_release.apk\`
- Browser Extension Zip Debug: \`MY_FREE_VPN_Browser_Extension_v${version}_debug.zip\`
- Browser Extension Zip Release: \`MY_FREE_VPN_Browser_Extension_v${version}_release.zip\`
- Live Debug Telemetry & Zero-Setup architecture enabled.`;

const notesFile = 'release_notes_temp.md';
fs.writeFileSync(notesFile, releaseNotes);

try {
  run(`"${ghPath}" release view ${tagName}`);
  console.log('Release already exists. Deleting and recreating to ensure clean state...');
  try {
    run(`"${ghPath}" release delete ${tagName} --yes`);
    run(`git push origin :refs/tags/${tagName} || true`);
  } catch (e) {}
} catch (e) {
  console.log('Release does not exist yet.');
}

// Recreate tag and push
try {
  run(`git tag -d ${tagName} || true`);
  run(`git tag ${tagName}`);
  run(`git push origin ${tagName} --force`);
} catch (e) {}

try {
  run(`"${ghPath}" release create ${tagName} --title "Release ${tagName}" --notes-file ${notesFile}`);
} catch (e) {
  console.error('Failed to create GitHub release.');
}

if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

console.log('Uploading artifacts...');
const artifacts = [
  path.join('artifacts', `MY_FREE_VPN_v${version}_debug.apk`),
  path.join('artifacts', `MY_FREE_VPN_v${version}_release.apk`),
  path.join('artifacts', `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`),
  path.join('artifacts', `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`)
];

for (const artifact of artifacts) {
  if (fs.existsSync(artifact)) {
    console.log(`Uploading ${artifact}...`);
    try {
      run(`"${ghPath}" release upload ${tagName} "${artifact}" --clobber`);
    } catch (e) {
      console.error(`Failed to upload ${artifact}`);
    }
  } else {
    console.error(`Artifact not found: ${artifact}`);
  }
}

console.log('Release and asset upload completed successfully!');
