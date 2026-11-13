/**
 * tools/generate_checksums.js
 * Iterates over files in artifacts/, computes SHA-256 hashes,
 * and writes a standard SHA256SUMS file into artifacts/SHA256SUMS.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const artifactsDir = path.join(__dirname, '..', 'artifacts');

if (!fs.existsSync(artifactsDir)) {
  console.error(`Artifacts directory not found: ${artifactsDir}`);
  process.exit(1);
}

const entries = fs.readdirSync(artifactsDir);
const lines = [];

for (const entry of entries) {
  if (entry === 'SHA256SUMS') continue;
  const filePath = path.join(artifactsDir, entry);
  const stat = fs.statSync(filePath);
  if (stat.isFile()) {
    const fileBuffer = fs.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    lines.push(`${hash}  ${entry}`);
  }
}

// Sort lines alphabetically by filename for deterministic order
lines.sort((a, b) => {
  const fileA = a.split('  ')[1];
  const fileB = b.split('  ')[1];
  return fileA.localeCompare(fileB);
});

const sumsPath = path.join(artifactsDir, 'SHA256SUMS');
fs.writeFileSync(sumsPath, lines.join('\n') + '\n', 'utf8');
console.log(`Generated SHA256SUMS at ${sumsPath} with ${lines.length} checksums:`);
lines.forEach(l => console.log(`  ${l}`));
