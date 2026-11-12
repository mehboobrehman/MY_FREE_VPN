const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filesToUpdate = {
  'version.json': { old: '1.1.19', new: '1.1.21' },
  'client/pubspec.yaml': { old: '1.1.19+19', new: '1.1.21+20' },
  'client/lib/config/version_config.dart': [{ old: "version = '1.1.19'", new: "version = '1.1.21'" }, { old: 'buildNumber = 19', new: 'buildNumber = 20' }],
  'browser-extension/manifest.json': { old: '1.1.19', new: '1.1.21' },
  'browser-extension/package.json': { old: '1.1.19', new: '1.1.21' },
  'backend/package.json': { old: '1.1.19', new: '1.1.21' },
  'backend/package-lock.json': { old: '1.1.19', new: '1.1.21' },
  'developer-viewer/index.html': { old: '1.1.19', new: '1.1.21' },
  'build_extension.js': { old: '1.1.19', new: '1.1.21' },
  'perform_release.js': { old: "'1.1.19'", new: "'1.1.21'" },
  'copy_apks.js': { old: "'1.1.19'", new: "'1.1.21'" },
  'setup_artifacts.js': { old: "'1.1.19'", new: "'1.1.21'" },
  'upload_release.js': { old: "'1.1.19'", new: "'1.1.21'" },
  'bump_and_build.js': [
    { old: "oldVersion = '1.1.18'", new: "oldVersion = '1.1.19'" },
    { old: "newVersion = '1.1.19'", new: "newVersion = '1.1.21'" },
    { old: 'oldBuild = 18', new: 'oldBuild = 19' },
    { old: 'newBuild = 19', new: 'newBuild = 20' }
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
