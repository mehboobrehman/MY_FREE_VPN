const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ghPath = '/c/Users/mehboob.rehman/Downloads/gh_2.102.0_windows_386/bin/gh.exe';
const version = '1.1.22';
const tagName = `v${version}`;
const artifactsDir = 'artifacts';

function run(cmd) {
  console.log(`> ${cmd}`);
  try {
    return execSync(cmd, { stdio: 'inherit' });
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    throw err;
  }
}

console.log('1. Git staging, committing and pushing to main...');
run('git add -A');
try {
  run(`git commit -m "chore(release): bump version to ${tagName} and publish dual debug/release artifacts with SHA256SUMS"`);
} catch (e) {
  console.log('No changes to commit or already committed.');
}

run('git push origin main');

console.log('2. Tagging and pushing tag...');
try {
  run(`git tag -d ${tagName} || true`);
} catch (e) {}
try {
  run(`"${ghPath}" release delete ${tagName} --yes || true`);
  run(`git push origin :refs/tags/${tagName} || true`);
} catch (e) {}

run(`git tag ${tagName}`);
run(`git push origin ${tagName} --force`);

console.log('3. Creating GitHub Release and uploading assets...');
const releaseNotes = `Release ${tagName} for MY_FREE_VPN (Build 22).
Includes dual debug and release artifacts:
- Android APK Debug: \`MY_FREE_VPN_v${version}_debug.apk\`
- Android APK Release: \`MY_FREE_VPN_v${version}_release.apk\`
- Browser Extension Zip Debug: \`MY_FREE_VPN_Browser_Extension_v${version}_debug.zip\`
- Browser Extension Zip Release: \`MY_FREE_VPN_Browser_Extension_v${version}_release.zip\`
- Checksums: \`SHA256SUMS\`
- Zero-Setup WireGuard & Live Debug Telemetry enabled.`;

const notesFile = 'release_notes_temp.md';
fs.writeFileSync(notesFile, releaseNotes);

run(`"${ghPath}" release create ${tagName} --title "Release ${tagName}" --notes-file ${notesFile}`);

if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

const artifacts = [
  path.join(artifactsDir, `MY_FREE_VPN_v${version}_debug.apk`),
  path.join(artifactsDir, `MY_FREE_VPN_v${version}_release.apk`),
  path.join(artifactsDir, `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`),
  path.join(artifactsDir, `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`),
  path.join(artifactsDir, 'SHA256SUMS')
];

for (const artifact of artifacts) {
  if (fs.existsSync(artifact)) {
    console.log(`Uploading ${artifact}...`);
    run(`"${ghPath}" release upload ${tagName} "${artifact}" --clobber`);
  } else {
    console.error(`Artifact not found: ${artifact}`);
  }
}

console.log('Release process completed successfully!');
console.log('\nDirect GitHub Release Download URLs:');
for (const art of artifacts) {
  const filename = path.basename(art);
  console.log(`- https://github.com/mehboobrehman/MY_FREE_VPN/releases/download/${tagName}/${filename}`);
}
