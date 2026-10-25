#!/usr/bin/env node
/**
 * Fetches the in-browser LibreOffice converter that previews office documents as PDFs
 * (https://github.com/Skitionek/serverless-office-converter) into vendor/office-converter,
 * from where angular.json copies it to /assets/vendor/office-converter.
 *
 * The engine is published as xz-compressed parts meant to be unpacked by the package's
 * service worker; Mycelium serves its own headers instead (see nginx.conf), so the parts
 * are decompressed here into the plain files the engine loads.
 *
 * Needs git and xz. Failing is not fatal: without the converter, the client falls
 * back to converting on the server.
 */

const {execFileSync} = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPOSITORY = 'Skitionek/serverless-office-converter';
const COMMIT = 'cd6c4a13e67f5b03063bc8094c5406b1d7efe1d5';

const dest = path.join(__dirname, '..', 'vendor', 'office-converter');
const stamp = path.join(dest, '.commit');

// The files the engine needs at run time; the rest of the package (service worker, xz
// decoder, file system helpers for standalone pages) is not used by Mycelium.
const SCRIPTS = ['index.js', 'office-engine.js', 'isolation.js', 'formats.js', 'file-system.js',
  'engine-worker.js', 'lo-thread.js', 'README.md'];

function fetchConverter() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'office-converter-'));
  try {
    const checkout = path.join(tmp, 'source');
    const git = (...args) => execFileSync('git', ['-C', checkout, ...args], {stdio: 'inherit'});
    fs.mkdirSync(checkout);
    git('init', '--quiet');
    git('fetch', '--quiet', '--depth', '1', `https://github.com/${REPOSITORY}`, COMMIT);
    git('-c', 'advice.detachedHead=false', 'checkout', '--quiet', 'FETCH_HEAD');
    const source = path.join(checkout, 'web', 'office-converter');

    const staging = path.join(tmp, 'out');
    fs.mkdirSync(path.join(staging, 'lo'), {recursive: true});
    for (const name of SCRIPTS) {
      fs.copyFileSync(path.join(source, name), path.join(staging, name));
    }
    const manifestPath = path.join(source, 'lo', 'manifest.json');
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const [name, entry] of Object.entries(manifest.files)) {
      const target = path.join(staging, 'lo', name);
      const parts = entry.parts.map(part => path.join(source, 'lo', part));
      if (entry.encoding === 'xz') {
        execFileSync('sh', ['-c', 'cat "$@" | xz -dc > "$0"', target, ...parts]);
      } else if (entry.encoding) {
        throw new Error(`${name}: unsupported encoding ${entry.encoding}`);
      } else {
        fs.writeFileSync(target, Buffer.concat(parts.map(part => fs.readFileSync(part))));
      }
      const size = fs.statSync(target).size;
      if (size !== entry.size) {
        throw new Error(`${name}: expected ${entry.size} bytes, got ${size}`);
      }
    }
    fs.copyFileSync(manifestPath, path.join(staging, 'lo', 'manifest.json'));
    fs.writeFileSync(path.join(staging, '.commit'), COMMIT + '\n');

    fs.rmSync(dest, {recursive: true, force: true});
    fs.mkdirSync(path.dirname(dest), {recursive: true});
    fs.cpSync(staging, dest, {recursive: true});
    console.log(`Office converter ${manifest.libreoffice} (${COMMIT.slice(0, 7)}) is in ${dest}`);
  } finally {
    fs.rmSync(tmp, {recursive: true, force: true});
  }
}

if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === COMMIT) {
  process.exit(0);
}
try {
  fetchConverter();
} catch (e) {
  console.warn(`Could not fetch the office converter, office documents will be converted `
    + `on the server: ${e.message}`);
}
