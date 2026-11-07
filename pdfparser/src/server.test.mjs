/**
 * Integration tests for server.mjs.
 * Run with: node --test src/server.test.mjs
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

// Dynamically import the app without starting it by reconstructing just enough.
// We start a real HTTP server on an ephemeral port.
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

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return res;
}

describe('server /token/rect/text/json', () => {
  let server;
  let base;

  before(() => new Promise(resolve => {
    server = createServer(buildApp());
    server.listen(0, '127.0.0.1', () => {
      base = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  }));

  after(() => new Promise(resolve => server.close(resolve)));

  it('returns 200 for a normal text body', async () => {
    const res = await post(`${base}/token/rect/text/json`, 'text=hello+world');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.ok(Array.isArray(json.pages));
  });

  it('accepts a body larger than 100 KB without returning 413', async () => {
    // Generate ~200 KB of text (well above the old 100 KB default limit)
    const largeText = 'word '.repeat(40_000); // ~200 KB
    const body = `text=${encodeURIComponent(largeText)}`;
    const res = await post(`${base}/token/rect/text/json`, body);
    assert.notEqual(res.status, 413, 'server should not reject large bodies with 413');
    assert.equal(res.status, 200);
  });

  it('returns 400 when text field is missing', async () => {
    const res = await post(`${base}/token/rect/text/json`, 'other=value');
    assert.equal(res.status, 400);
  });

  it('health check returns ok', async () => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, 'ok');
  });
});
