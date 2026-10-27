/**
 * Integration tests for server.mjs (HTTP layer).
 * Run with: node --test src/server.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).toString();

// Spin up the server on an ephemeral port for the duration of these tests.
// We import the app directly so we don't depend on the PORT env var.
import express from 'express';
import { parseText } from './parse.mjs';

function buildApp() {
  const app = express();
  app.use(express.urlencoded({ extended: false, limit: '50mb' }));

  app.post('/token/rect/text/json', (req, res) => {
    const text = req.body?.text;
    if (typeof text !== 'string') {
      return res.status(400).json({ error: 'Provide the text in the "text" form field.' });
    }
    res.json(parseText(text));
  });

  app.get('/', (_req, res) => res.json({ status: 'ok' }));

  return app;
}

function post(server, path, body) {
  return new Promise((resolve, reject) => {
    const { port } = server.address();
    const encoded = new URLSearchParams(body).toString();
    const req = http.request(
      { hostname: '127.0.0.1', port, path, method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded',
                   'Content-Length': Buffer.byteLength(encoded) } },
      (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      },
    );
    req.on('error', reject);
    req.write(encoded);
    req.end();
  });
}

let server;

before(() => new Promise((resolve) => {
  server = buildApp().listen(0, '127.0.0.1', resolve);
}));

after(() => new Promise((resolve, reject) => {
  server.close(err => (err ? reject(err) : resolve()));
}));

describe('POST /token/rect/text/json', () => {
  it('parses a small text body', async () => {
    const res = await post(server, '/token/rect/text/json', { text: 'hello world' });
    assert.equal(res.status, 200);
    assert.equal(res.body.pages.length, 1);
    assert.equal(res.body.pages[0].tokens[0].text, 'hello');
  });

  it('accepts a body larger than the default 100 KB limit', async () => {
    // Build a ~200 KB text payload — well above Express's default 100 KB limit.
    const largeText = 'word '.repeat(40_000); // ≈ 200 KB
    const res = await post(server, '/token/rect/text/json', { text: largeText });
    assert.equal(res.status, 200, `Expected 200 but got ${res.status}; body: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.pages[0].tokens.length > 0);
  });

  it('returns 400 when text field is missing', async () => {
    const res = await post(server, '/token/rect/text/json', { other: 'value' });
    assert.equal(res.status, 400);
  });
});
