const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ghPath = 'C:\\Users\\mehboob.rehman\\Downloads\\gh_2.102.0_windows_386\\bin\\gh.exe';
const version = '1.1.22';
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

console.log('1. Staging specific git changes...');
run('git add DECISIONS.md version.json build_extension.js');
run('git add backend/ package.json package-lock.json 2>nul || true');
run('git add browser-extension/ client/lib/ client/pubspec.yaml client/test/ 2>nul || true');
run('git add docs/ tools/ contracts/ developer-viewer/ .github/ 2>nul || true');
run('git add artifacts/ 2>nul || true');

console.log('2. Committing changes...');
try {
  run(`git commit -m "chore(release): bump version to ${tagName} and publish dual debug/release artifacts"`);
} catch (e) {
  console.log('No changes to commit or commit already made.');
}

console.log('3. Pushing to origin main...');
run('git push origin main');

console.log('4. Tagging and pushing tag...');
try {
  run(`git tag ${tagName}`);
} catch (e) {
  console.log('Tag already exists locally.');
}
try {
  run(`git push origin ${tagName} --force`);
} catch (e) {
  console.log('Failed to push tag or already pushed.');
}

console.log('5. Creating GitHub Release...');
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
  run(`"${ghPath}" release create ${tagName} --title "Release ${tagName}" --notes-file ${notesFile} --clobber`);
} catch (e) {
  console.log('Release may already exist or error occurred.');
}

if (fs.existsSync(notesFile)) {
  fs.unlinkSync(notesFile);
}

console.log('6. Uploading artifacts...');
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

console.log('Release process finished successfully!');
