#!/usr/bin/env node
/**
 * Unpacks the engine of the in-browser LibreOffice converter that previews office documents
 * as PDFs (serverless-office-converter, installed from GitHub; see package.json). Run after
 * every install.
 *
 * The package ships its engine as xz-compressed parts, meant to be unpacked in the browser
 * by its service worker. Mycelium sends the headers the engine needs itself (see nginx.conf),
 * so the parts are decompressed here, with the package's own decoder, into the plain files
 * the engine loads. angular.json serves them under /assets/vendor/office-converter.
 */

const fs = require('fs');
const path = require('path');
const {Readable} = require('stream');
const {pipeline} = require('stream/promises');
const vm = require('vm');

const packageDir = path.join(__dirname, '..', 'node_modules', 'serverless-office-converter',
  'web', 'office-converter');
const runtimeDir = path.join(packageDir, 'lo');

/** The decoder is a UMD script, but its package is an ES module one: run it as CommonJS. */
function loadDecoder() {
  const file = path.join(packageDir, 'vendor', 'xz-decompress.min.js');
  const module = {exports: {}};
  vm.runInThisContext(`(function (module, exports, require) {${fs.readFileSync(file, 'utf8')}\n})`,
    {filename: file})(module, module.exports, require);
  return module.exports;
}

async function unpack(name, entry) {
  const target = path.join(runtimeDir, name);
  if (fs.existsSync(target) && fs.statSync(target).size === entry.size) {
    return;
  }
  if (entry.encoding !== 'xz') {
    throw new Error(`${name}: unsupported encoding ${entry.encoding}`);
  }
  const {XzReadableStream} = loadDecoder();
  const parts = Readable.toWeb(Readable.from((async function* () {
    for (const part of entry.parts) {
      yield* fs.createReadStream(path.join(runtimeDir, part));
    }
  })()));
  const partial = target + '.partial';
  await pipeline(Readable.fromWeb(new XzReadableStream(parts)), fs.createWriteStream(partial));
  const size = fs.statSync(partial).size;
  if (size !== entry.size) {
    throw new Error(`${name}: expected ${entry.size} bytes, got ${size}`);
  }
  fs.renameSync(partial, target);
}

async function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(runtimeDir, 'manifest.json'), 'utf8'));
  for (const [name, entry] of Object.entries(manifest.files)) {
    await unpack(name, entry);
  }
}

main().catch(e => {
  // Without the engine, the client converts office documents on the server instead
  console.warn(`Could not unpack the office converter: ${e.message}`);
});
