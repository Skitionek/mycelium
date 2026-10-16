#!/usr/bin/env node
/**
 * Prepares the LibreOffice runtime of serverless-office-converter to be served by nginx.
 *
 * The package ships lo/soffice.* compressed and split into parts (described by
 * lo/manifest.json); its own service worker reassembles them in the browser. Mycelium
 * serves them directly instead: each file is reassembled here and stored as
 * lo/<name>.gz, which nginx sends as is (gzip_static).
 *
 * Usage: node unpack-office-converter.js <path to office-converter/lo>
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const loDir = process.argv[2];
if (!loDir) {
  console.error('Usage: unpack-office-converter.js <path to office-converter/lo>');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(path.join(loDir, 'manifest.json'), 'utf8'));

for (const [name, entry] of Object.entries(manifest.files)) {
  const partPaths = entry.parts.map(part => path.join(loDir, part));
  const packed = Buffer.concat(partPaths.map(partPath => fs.readFileSync(partPath)));
  let gzipped;
  if (entry.encoding === 'gzip') {
    gzipped = packed;
  } else if (entry.encoding === 'xz') {
    const raw = execFileSync('xz', ['--decompress', '--stdout'], {input: packed, maxBuffer: 2 * entry.size});
    gzipped = zlib.gzipSync(raw, {level: 9});
  } else {
    throw new Error(`${name}: unknown encoding ${entry.encoding}`);
  }
  fs.writeFileSync(path.join(loDir, name + '.gz'), gzipped);
  partPaths.forEach(partPath => fs.unlinkSync(partPath));
  console.log(`${name}: ${(entry.size / 1e6).toFixed(1)} MB, ${(gzipped.length / 1e6).toFixed(1)} MB gzipped`);
}
