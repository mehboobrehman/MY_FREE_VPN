const fs = require('fs');
const path = require('path');

const oldVersion = '1.1.20';
const newVersion = '1.1.21';
const oldBuild = 20;
const newBuild = 21;

const filesToUpdate = [
  'version.json',
  'client/pubspec.yaml',
  'client/lib/config/version_config.dart',
  'browser-extension/manifest.json',
  'browser-extension/package.json',
  'backend/package.json',
  'backend/package-lock.json',
  'developer-viewer/index.html',
  'build_extension.js',
  'perform_release.js',
  'copy_apks.js',
  'setup_artifacts.js',
  'upload_release.js',
  'bump_and_build.js',
  'bump_versions.js',
  'build.ps1'
];

for (const file of filesToUpdate) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Replace version
    content = content.replace(new RegExp(oldVersion, 'g'), newVersion);
    
    // Replace build number (only if applicable, use some heuristics)
    if (file.includes('pubspec.yaml')) {
        content = content.replace(oldBuild.toString(), newBuild.toString());
    } else if (file.includes('version_config.dart') || file.includes('bump_and_build.js')) {
        content = content.replace(`buildNumber = ${oldBuild}`, `buildNumber = ${newBuild}`);
        content = content.replace(`oldBuild = ${oldBuild}`, `oldBuild = ${newBuild}`);
        content = content.replace(`newBuild = ${oldBuild}`, `newBuild = ${newBuild}`);
        content = content.replace(`oldBuild = ${oldBuild-1}`, `oldBuild = ${oldBuild}`); // Update historical build number if needed
        content = content.replace(`newBuild = ${oldBuild}`, `newBuild = ${newBuild}`); // Update historical build number if needed
    }
    
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
}
console.log('Version bump to 1.1.21 complete.');
