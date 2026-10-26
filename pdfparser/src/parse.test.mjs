/**
 * Unit tests for parse.mjs.
 * Run with: node --test src/parse.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePdf, parseText } from './parse.mjs';

const require = createRequire(import.meta.url);
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
  require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs'),
).toString();

const __dir = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PDF = resolve(
  __dir,
  '../../appserver/tests/database/services/annotations/pdf_samples/554. salazar msystems 20.pdf',
);

describe('parseText', () => {
  it('returns one page with word tokens', () => {
    const result = parseText('hello world foo');

    assert.equal(result.pages.length, 1);
    assert.equal(result.pages[0].pageText, 'hello world foo');
    assert.equal(result.pages[0].tokens.length, 3);
    assert.equal(result.pages[0].tokens[0].text, 'hello');
    assert.equal(result.pages[0].tokens[0].pgIdx, 0);
    assert.equal(result.pages[0].tokens[1].text, 'world');
    assert.equal(result.pages[0].tokens[1].pgIdx, 6);
  });

  it('sets possibleAbbrev to false for all tokens', () => {
    const result = parseText('NF-kB (nuclear)');
    assert.ok(result.pages[0].tokens.every(t => t.possibleAbbrev === false));
  });
});

describe('parsePdf', () => {
  it('returns pages with word tokens from a real PDF', async () => {
    const data = new Uint8Array(readFileSync(FIXTURE_PDF));
    const result = await parsePdf(data, pdfjsLib);

    assert.ok(result.pages.length > 0, 'should have at least one page');

    const firstPage = result.pages[0];
    assert.equal(typeof firstPage.pageText, 'string');
    assert.ok(firstPage.pageText.length > 0, 'pageText should not be empty');
    assert.ok(firstPage.tokens.length > 0, 'tokens should not be empty');

    const token = firstPage.tokens[0];
    assert.equal(typeof token.text, 'string');
    assert.ok(token.text.length > 0);
    assert.equal(typeof token.pgIdx, 'number');
    assert.equal(token.possibleAbbrev, false);
    assert.equal(token.rects.length, 1);

    const rect = token.rects[0];
    assert.equal(typeof rect.lowerLeftPt.x, 'number');
    assert.equal(typeof rect.lowerLeftPt.y, 'number');
    assert.equal(typeof rect.width, 'number');
    assert.equal(typeof rect.height, 'number');
    assert.equal(typeof rect.rotation, 'number');
  });

  it('pgIdx is a valid offset into pageText for each token', async () => {
    const data = new Uint8Array(readFileSync(FIXTURE_PDF));
    const result = await parsePdf(data, pdfjsLib);

    for (const page of result.pages) {
      for (const token of page.tokens) {
        const slice = page.pageText.slice(token.pgIdx, token.pgIdx + token.text.length);
        assert.equal(
          slice, token.text,
          `token "${token.text}" at pgIdx ${token.pgIdx}: pageText slice is "${slice}"`
        );
      }
    }
  });
});
