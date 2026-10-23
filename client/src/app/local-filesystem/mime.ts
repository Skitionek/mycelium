import { MimeTypes } from 'app/shared/constants';

/**
 * Local files have no server-side type detection, so their MIME type is derived from the
 * file name and, for ambiguous containers like JSON and XML, from the first few kilobytes.
 * The result mirrors what the appserver would store for the same upload, so the file opens
 * in the same viewer it would open in after uploading.
 */

export const SNIFF_BYTES = 8192;

const EXTENSION_MIME_TYPES: { [extension: string]: string } = {
  '.pdf': MimeTypes.Pdf,
  '.pdb': MimeTypes.Pdb,
  '.cif': MimeTypes.Cif,
  '.mmcif': MimeTypes.Cif,
  '.llmap': MimeTypes.Map,
  '.graph': MimeTypes.Graph,
  '.enrichment': MimeTypes.EnrichmentTable,
  '.bioc': MimeTypes.BioC,
  '.annotations': 'application/json',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
  '.text': 'text/plain',
  '.log': 'text/plain',
  '.tsv': 'text/plain',
  '.tab': 'text/plain',
  '.fasta': 'text/plain',
  '.fa': 'text/plain',
  '.gff': 'text/plain',
  '.gtf': 'text/plain',
  '.bed': 'text/plain',
  '.vcf': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.py': 'text/x-python',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.ods': 'application/vnd.oasis.opendocument.spreadsheet',
  '.odp': 'application/vnd.oasis.opendocument.presentation',
  '.rtf': 'application/rtf',
};

/**
 * Extensions a newly created local file gets when its name has none, so that the file is
 * recognised as the same type when it is listed again.
 */
const MIME_TYPE_EXTENSIONS: { [mimeType: string]: string } = {
  [MimeTypes.Map]: '.llmap',
  [MimeTypes.Graph]: '.graph',
  [MimeTypes.EnrichmentTable]: '.enrichment',
  [MimeTypes.Dmp]: '.json',
  [MimeTypes.BioC]: '.bioc',
  [MimeTypes.Pdf]: '.pdf',
  [MimeTypes.Sdrf]: '.sdrf.tsv',
};

const GENERIC_MIME_TYPE = 'application/octet-stream';

export function getExtension(filename: string): string {
  const lower = (filename || '').toLowerCase();
  const dot = lower.lastIndexOf('.');
  // A leading dot is a hidden file name, not an extension ('.annotations' is special-cased)
  if (dot < 0 || (dot === 0 && lower !== '.annotations')) {
    return '';
  }
  return lower.slice(dot);
}

export function guessMimeType(filename: string): string {
  // Sample and data relationship files are TSV files named by convention (see SdrfTypeProvider)
  if ((filename || '').toLowerCase().endsWith('.sdrf.tsv')) {
    return MimeTypes.Sdrf;
  }
  return EXTENSION_MIME_TYPES[getExtension(filename)] || GENERIC_MIME_TYPE;
}

/**
 * Whether the type guessed from the name alone may be refined by looking at the content.
 */
export function needsContentSniffing(filename: string): boolean {
  const extension = getExtension(filename);
  return extension === '' || extension === '.json' || extension === '.xml' || extension === '.bioc';
}

/**
 * Refine a name-based guess using the beginning of the file.
 * @param filename the file name
 * @param head the first {@link SNIFF_BYTES} of the file, decoded as text
 */
export function refineMimeType(filename: string, head: string): string {
  const guessed = guessMimeType(filename);
  const extension = getExtension(filename);
  if (extension === '.json' || (extension === '' && /^\s*{/.test(head))) {
    if (/"dmp"\s*:/.test(head)) {
      return MimeTypes.Dmp;
    }
    if (/"genes"\s*:/.test(head) && /"organism"\s*:/.test(head)) {
      return MimeTypes.EnrichmentTable;
    }
    return 'application/json';
  }
  if (extension === '.xml' || extension === '.bioc' || (extension === '' && /^\s*</.test(head))) {
    if (/<collection[\s>]/.test(head)) {
      return MimeTypes.BioC;
    }
    return extension === '.bioc' ? MimeTypes.BioC : 'application/xml';
  }
  if (extension === '' && head.startsWith('%PDF-')) {
    return MimeTypes.Pdf;
  }
  return guessed;
}

export async function detectMimeType(filename: string, file: Blob): Promise<string> {
  if (!needsContentSniffing(filename)) {
    return guessMimeType(filename);
  }
  try {
    const head = await file.slice(0, SNIFF_BYTES).text();
    return refineMimeType(filename, head);
  } catch (e) {
    return guessMimeType(filename);
  }
}

/**
 * Give a file name an extension matching its type when it has none.
 */
export function withTypeExtension(filename: string, mimeType: string): string {
  const extension = MIME_TYPE_EXTENSIONS[mimeType];
  if (!extension || getExtension(filename)) {
    return filename;
  }
  return filename + extension;
}

export function isPdfConvertible(filename: string, mimeType: string): boolean {
  const officeExtensions = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', '.rtf'];
  return officeExtensions.includes(getExtension(filename))
    || Object.entries(EXTENSION_MIME_TYPES)
      .some(([extension, type]) => officeExtensions.includes(extension) && type === mimeType);
}
