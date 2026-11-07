import { MimeTypes } from 'app/shared/constants';

import { collectJsonStrings, countTerms, extractText, isTextIndexable, makeExcerpt, tokenize } from './text-extraction';

describe('local text extraction', () => {
  it('tokenizes into lower-cased terms, keeping gene-like identifiers', () => {
    expect(tokenize('The BRCA1 gene and p53-dependent IL-6 signalling.'))
      .toEqual(['brca1', 'gene', 'p53-dependent', 'il-6', 'signalling']);
    expect(tokenize('Über α-synuclein')).toEqual(['über', 'α-synuclein']);
  });

  it('counts terms, most frequent first, up to a limit', () => {
    const terms = countTerms('kinase kinase kinase gene gene protein', 2);
    expect(terms).toEqual({kinase: 3, gene: 2});
  });

  it('collects the strings of JSON documents', () => {
    const text = collectJsonStrings({graph: {nodes: [{label: 'TP53'}, {label: 'MDM2', size: 3}]}, title: 'p53 loop'});
    expect(text.split('\n')).toEqual(['TP53', 'MDM2', 'p53 loop']);
  });

  it('extracts text files and skips binary ones', async () => {
    expect(await extractText(new Blob(['hello world']), 'text/plain')).toEqual({text: 'hello world'});
    expect(await extractText(new Blob(['{"graph": {"description": "flux"}}']), MimeTypes.Graph))
      .toEqual({text: 'flux'});
    expect(await extractText(new Blob([new Uint8Array([1, 2, 3])]), 'image/png')).toBeNull();
    expect(isTextIndexable(MimeTypes.EnrichmentTable)).toBe(true);
    expect(isTextIndexable('application/zip')).toBe(false);
  });

  it('makes short excerpts', () => {
    expect(makeExcerpt('  a\n\nb  ')).toBe('a b');
    expect(makeExcerpt('x'.repeat(500), 10)).toBe('xxxxxxxxx…');
  });
});
