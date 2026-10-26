/**
 * HTTP wrapper around parse.mjs.
 * Exposes the same two endpoints the legacy lifelike-pdfparser container did
 * so the appserver needs no URL changes.
 *
 *   POST /token/rect/json/       multipart/form-data  file=<pdf bytes>
 *   POST /token/rect/text/json   application/x-www-form-urlencoded  text=<string>
 *   GET  /                       health check → { status: "ok" }
 */

import express from 'express';
import multer from 'multer';

// Use the legacy build so no canvas or DOM APIs are required in Node.js
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePdf, parseText } from './parse.mjs';

// Point pdf.js at the bundled worker so it can run in Node.js without a browser
const require = createRequire(import.meta.url);
const workerPath = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs');
pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();

const app = express();
app.use(express.urlencoded({ extended: false }));

const upload = multer({ storage: multer.memoryStorage() });

const PORT = Number(process.env.PORT ?? 7600);

app.post('/token/rect/json/', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Provide the PDF in the "file" form field.' });
  }
  try {
    const result = await parsePdf(new Uint8Array(req.file.buffer), pdfjsLib);
    res.json(result);
  } catch (err) {
    console.error('PDF parse error:', err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/token/rect/text/json', (req, res) => {
  const text = req.body?.text;
  if (typeof text !== 'string') {
    return res.status(400).json({ error: 'Provide the text in the "text" form field.' });
  }
  res.json(parseText(text));
});

app.get('/', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`pdfparser listening on :${PORT}`));
