const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToUpdate = {
  'version.json': { old: '1.1.18', new: '1.1.19' },
  'client/pubspec.yaml': { old: '1.1.18+18', new: '1.1.19+19' },
  'client/lib/config/version_config.dart': [{ old: "version = '1.1.18'", new: "version = '1.1.19'" }, { old: 'buildNumber = 18', new: 'buildNumber = 19' }],
  'browser-extension/manifest.json': { old: '1.1.18', new: '1.1.19' },
  'browser-extension/package.json': { old: '1.1.18', new: '1.1.19' },
  'backend/package.json': { old: '1.1.18', new: '1.1.19' },
  'backend/package-lock.json': { old: '1.1.18', new: '1.1.19' },
  'developer-viewer/index.html': { old: '1.1.18', new: '1.1.19' },
  'build_extension.js': { old: '1.1.18', new: '1.1.19' },
  'perform_release.js': { old: "'1.1.18'", new: "'1.1.19'" },
  'copy_apks.js': { old: "'1.1.18'", new: "'1.1.19'" },
  'setup_artifacts.js': { old: "'1.1.18'", new: "'1.1.19'" },
  'upload_release.js': { old: "'1.1.18'", new: "'1.1.19'" },
  'bump_and_build.js': [
    { old: "oldVersion = '1.1.17'", new: "oldVersion = '1.1.18'" },
    { old: "newVersion = '1.1.18'", new: "newVersion = '1.1.19'" },
    { old: 'oldBuild = 17', new: 'oldBuild = 18' },
    { old: 'newBuild = 18', new: 'newBuild = 19' }
  ]
};

for (const file in filesToUpdate) {
  let content = fs.readFileSync(file, 'utf8');
  const updates = Array.isArray(filesToUpdate[file]) ? filesToUpdate[file] : [filesToUpdate[file]];
  for (const update of updates) {
    content = content.split(update.old).join(update.new);
  }
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}

console.log('Version bump complete.');
