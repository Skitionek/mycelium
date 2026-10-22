import JSZip from 'jszip';

import { MimeTypes, PDF_WORKER_PATH } from 'app/shared/constants';

/**
 * Turning local files into searchable text. Everything here runs in the browser, so a
 * folder can be searched without any of its content leaving the machine.
 */

/** Text beyond this many characters is not indexed. */
export const MAX_INDEXED_CHARS = 5_000_000;
/** Plain-text files larger than this are only indexed up to this size. */
export const MAX_TEXT_FILE_BYTES = 16 * 1024 * 1024;
/** PDFs larger than this are not text-indexed. */
export const MAX_PDF_BYTES = 200 * 1024 * 1024;
/** Number of distinct terms kept per file, the most frequent first. */
export const MAX_TERMS_PER_FILE = 20000;
export const EXCERPT_LENGTH = 280;

const MIN_TERM_LENGTH = 2;
const MAX_TERM_LENGTH = 48;

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'in', 'is', 'it',
  'its', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'were', 'which', 'with', 'we', 'our',
  'not', 'but', 'can', 'these', 'those', 'than', 'then', 'there', 'their', 'been', 'into', 'also',
]);

const TEXT_MIME_TYPES = new Set<string>([
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-yaml',
  MimeTypes.EnrichmentTable,
  MimeTypes.Dmp,
  MimeTypes.BioC,
  MimeTypes.Sdrf,
  MimeTypes.Pdb,
  MimeTypes.Cif,
]);

const TOKEN_PATTERN = /[\p{L}\p{N}][\p{L}\p{N}\-_.']*[\p{L}\p{N}]|[\p{L}\p{N}]/gu;

export interface ExtractedText {
  text: string;
  pages?: number;
}

export type TermFrequencies = { [term: string]: number };

export function isTextIndexable(mimeType: string): boolean {
  return mimeType === MimeTypes.Pdf
    || mimeType === MimeTypes.Map
    || mimeType === MimeTypes.Graph
    || mimeType.startsWith('text/')
    || TEXT_MIME_TYPES.has(mimeType);
}

/**
 * Split text into lower-cased search terms.
 */
export function tokenize(text: string): string[] {
  const terms: string[] = [];
  for (const match of (text || '').toLowerCase().matchAll(TOKEN_PATTERN)) {
    const term = match[0].replace(/^[\-_.']+|[\-_.']+$/g, '');
    if (term.length >= MIN_TERM_LENGTH && term.length <= MAX_TERM_LENGTH && !STOP_WORDS.has(term)) {
      terms.push(term);
    }
  }
  return terms;
}

export function countTerms(text: string, limit = MAX_TERMS_PER_FILE): TermFrequencies {
  const counts = new Map<string, number>();
  for (const term of tokenize(text)) {
    counts.set(term, (counts.get(term) || 0) + 1);
  }
  const sorted = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, limit);
  const result: TermFrequencies = {};
  for (const [term, count] of sorted) {
    result[term] = count;
  }
  return result;
}

export function makeExcerpt(text: string, length = EXCERPT_LENGTH): string {
  const collapsed = (text || '').replace(/\s+/g, ' ').trim();
  return collapsed.length > length ? collapsed.slice(0, length - 1) + '…' : collapsed;
}

/**
 * Extract the indexable text of a file.
 * @return the text, or null if the file type has no text to index
 */
export async function extractText(file: Blob, mimeType: string): Promise<ExtractedText | null> {
  if (mimeType === MimeTypes.Pdf) {
    if (file.size > MAX_PDF_BYTES) {
      return null;
    }
    return extractPdfText(file);
  }
  if (mimeType === MimeTypes.Map) {
    return {text: await extractMapText(file)};
  }
  if (mimeType === MimeTypes.Graph) {
    return {text: collectJsonStrings(JSON.parse(await file.text()))};
  }
  if (isTextIndexable(mimeType)) {
    const text = await file.slice(0, MAX_TEXT_FILE_BYTES).text();
    return {text: text.slice(0, MAX_INDEXED_CHARS)};
  }
  return null;
}

/**
 * Collect the string values of a JSON document, which is how the appserver indexes
 * graph-like documents too.
 */
export function collectJsonStrings(value: any, out: string[] = [], budget = {chars: MAX_INDEXED_CHARS}): string {
  if (budget.chars <= 0) {
    return out.join('\n');
  }
  if (typeof value === 'string') {
    out.push(value);
    budget.chars -= value.length;
  } else if (Array.isArray(value)) {
    for (const item of value) {
      collectJsonStrings(item, out, budget);
    }
  } else if (value != null && typeof value === 'object') {
    for (const key of Object.keys(value)) {
      collectJsonStrings(value[key], out, budget);
    }
  }
  return out.join('\n');
}

async function extractMapText(file: Blob): Promise<string> {
  const zip = await JSZip.loadAsync(file);
  const graph = zip.file('graph.json');
  if (graph == null) {
    return '';
  }
  return collectJsonStrings(JSON.parse(await graph.async('text')));
}

async function extractPdfText(file: Blob): Promise<ExtractedText> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  });
  const document = await loadingTask.promise;
  try {
    const parts: string[] = [];
    let chars = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages && chars < MAX_INDEXED_CHARS; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item: any) => item.str || '').join(' ');
      parts.push(pageText);
      chars += pageText.length;
      page.cleanup();
    }
    return {text: parts.join('\n').slice(0, MAX_INDEXED_CHARS), pages: document.numPages};
  } finally {
    await loadingTask.destroy();
  }
}

let pdfJsPromise: Promise<any> | null = null;

function loadPdfJs(): Promise<any> {
  if (pdfJsPromise == null) {
    pdfJsPromise = import('pdfjs-dist').then(pdfjs => {
      const lib: any = (pdfjs as any).getDocument ? pdfjs : (pdfjs as any).default;
      if (!lib.GlobalWorkerOptions.workerSrc) {
        // Same worker the PDF viewer configures (see PdfViewerComponent)
        const custom = (window as any).pdfWorkerSrc;
        lib.GlobalWorkerOptions.workerSrc = typeof custom === 'string' && custom
          ? custom
          : new URL(PDF_WORKER_PATH, document.baseURI).toString();
      }
      return lib;
    }).catch(error => {
      pdfJsPromise = null;
      throw error;
    });
  }
  return pdfJsPromise;
}
