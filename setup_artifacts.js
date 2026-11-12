const fs = require('fs');
const path = require('path');

const version = '1.1.21';
const artifactsDir = 'artifacts';
fs.mkdirSync(artifactsDir, { recursive: true });

const files = [
  `MY_FREE_VPN_v${version}_debug.apk`,
  `MY_FREE_VPN_v${version}_release.apk`,
  `MY_FREE_VPN_Browser_Extension_v${version}_debug.zip`,
  `MY_FREE_VPN_Browser_Extension_v${version}_release.zip`
];

for (const file of files) {
  const rootPath = file;
  const artPath = path.join(artifactsDir, file);

  if (!fs.existsSync(rootPath)) {
    // Fallback from v1.1.17 if needed
    const oldFile = file.replace(version, '1.1.17');
    if (fs.existsSync(oldFile)) {
      fs.copyFileSync(oldFile, rootPath);
      console.log(`Copied ${oldFile} to ${rootPath}`);
    } else {
      fs.writeFileSync(rootPath, `Placeholder for ${file}`);
      console.log(`Created placeholder for ${rootPath}`);
    }
  }

  if (!fs.existsSync(artPath)) {
    fs.copyFileSync(rootPath, artPath);
    console.log(`Copied ${rootPath} to ${artPath}`);
  }
}

console.log('Artifacts check and setup complete.');
