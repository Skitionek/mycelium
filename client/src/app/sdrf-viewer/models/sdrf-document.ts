/**
 * SDRF-Proteomics document model.
 *
 * Parses, validates, and serializes Sample and Data Relationship Format (SDRF)
 * tab-delimited files as described in:
 *   https://github.com/bigbio/proteomics-sample-metadata
 */

export type SdrfColumnType =
  | 'source-name'
  | 'assay-name'
  | 'technology-type'
  | 'characteristics'
  | 'comment'
  | 'factor-value'
  | 'other';

export interface SdrfColumn {
  /** Raw header string as found in the file (e.g. "characteristics[organism]"). */
  header: string;
  /** Semantic type derived from the header prefix. */
  type: SdrfColumnType;
  /** Parameter inside brackets for characteristics/comment/factor-value, empty otherwise. */
  param: string;
}

export interface SdrfValidationError {
  message: string;
}

/**
 * Classifies a single SDRF column header into its semantic type.
 */
export function classifySdrfColumn(header: string): SdrfColumn {
  const h = header.trim().toLowerCase();

  const bracketMatch = h.match(/^([^[]+)\[([^\]]+)\]$/);

  if (h === 'source name') {
    return {header, type: 'source-name', param: ''};
  }
  if (h === 'assay name') {
    return {header, type: 'assay-name', param: ''};
  }
  if (h === 'technology type') {
    return {header, type: 'technology-type', param: ''};
  }
  if (bracketMatch) {
    const prefix = bracketMatch[1].trim();
    const param = bracketMatch[2].trim();
    if (prefix === 'characteristics') {
      return {header, type: 'characteristics', param};
    }
    if (prefix === 'comment') {
      return {header, type: 'comment', param};
    }
    if (prefix === 'factor value') {
      return {header, type: 'factor-value', param};
    }
  }
  return {header, type: 'other', param: ''};
}

/**
 * Parses TSV text into a 2-D array of strings.
 * Rows are separated by LF or CRLF; cells by tabs.
 * Trailing empty rows are dropped.
 */
function parseTsv(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const rows = lines.map(line => line.split('\t'));
  // Drop trailing blank rows
  while (rows.length > 0 && rows[rows.length - 1].every(cell => cell.trim() === '')) {
    rows.pop();
  }
  return rows;
}

/**
 * Serialises a 2-D array of strings back to TSV text.
 */
function serializeTsv(rows: string[][]): string {
  return rows.map(row => row.join('\t')).join('\n') + '\n';
}

export class SdrfDocument {
  columns: SdrfColumn[] = [];
  rows: string[][] = [];

  /** Load from a Blob (async). */
  static async fromBlob(blob: Blob): Promise<SdrfDocument> {
    const text = await blob.text();
    return SdrfDocument.fromText(text);
  }

  /** Load from a plain text string. */
  static fromText(text: string): SdrfDocument {
    const doc = new SdrfDocument();
    const allRows = parseTsv(text);
    if (allRows.length === 0) {
      return doc;
    }
    const headerRow = allRows[0];
    doc.columns = headerRow.map(classifySdrfColumn);
    doc.rows = allRows.slice(1).map(row => {
      // Pad short rows to match column count
      const padded = [...row];
      while (padded.length < doc.columns.length) {
        padded.push('');
      }
      return padded.slice(0, doc.columns.length);
    });
    return doc;
  }

  /** Serialise to TSV text. */
  toText(): string {
    const headerRow = this.columns.map(c => c.header);
    return serializeTsv([headerRow, ...this.rows]);
  }

  /** Serialise to a Blob suitable for uploading. */
  toBlob(): Blob {
    return new Blob([this.toText()], {type: 'text/tab-separated-values'});
  }

  /** Basic structural validation. */
  validate(): SdrfValidationError[] {
    const errors: SdrfValidationError[] = [];
    const types = new Set(this.columns.map(c => c.type));
    if (!types.has('source-name')) {
      errors.push({message: 'Missing required column: "source name"'});
    }
    if (!types.has('assay-name')) {
      errors.push({message: 'Missing required column: "assay name"'});
    }
    if (!types.has('technology-type')) {
      errors.push({message: 'Missing required column: "technology type"'});
    }
    return errors;
  }

  /** Add a blank row at the end. */
  addRow(): void {
    this.rows.push(this.columns.map(() => ''));
  }

  /** Remove a row by index. */
  removeRow(index: number): void {
    this.rows.splice(index, 1);
  }

  /** Returns a minimal blank SDRF document text with the required columns. */
  static blankTemplate(): string {
    const headers = [
      'source name',
      'characteristics[organism]',
      'characteristics[organism part]',
      'characteristics[disease]',
      'characteristics[biological replicate]',
      'assay name',
      'technology type',
      'comment[data file]',
    ];
    const doc = new SdrfDocument();
    doc.columns = headers.map(classifySdrfColumn);
    doc.rows = [];
    return doc.toText();
  }
}
