import { MimeTypes } from 'app/shared/constants';

import { detectMimeType, getExtension, guessMimeType, refineMimeType, withTypeExtension } from './mime';

describe('local MIME type detection', () => {
  it('guesses from extensions like the appserver', () => {
    expect(guessMimeType('paper.PDF')).toBe(MimeTypes.Pdf);
    expect(guessMimeType('1abc.pdb')).toBe(MimeTypes.Pdb);
    expect(guessMimeType('x.mmcif')).toBe(MimeTypes.Cif);
    expect(guessMimeType('pathway.llmap')).toBe(MimeTypes.Map);
    expect(guessMimeType('flows.graph')).toBe(MimeTypes.Graph);
    expect(guessMimeType('report.docx'))
      .toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(guessMimeType('script.py')).toBe('text/x-python');
    expect(guessMimeType('samples.SDRF.tsv')).toBe(MimeTypes.Sdrf);
    expect(guessMimeType('samples.tsv')).toBe('text/plain');
    expect(guessMimeType('README')).toBe('application/octet-stream');
  });

  it('treats dotfiles as having no extension, except .annotations', () => {
    expect(getExtension('.bashrc')).toBe('');
    expect(getExtension('.annotations')).toBe('.annotations');
    expect(guessMimeType('.annotations')).toBe('application/json');
  });

  it('recognises Mycelium documents stored as JSON', () => {
    expect(refineMimeType('plan.json', '{"dmp": {"title": "x"}}')).toBe(MimeTypes.Dmp);
    expect(refineMimeType('table.json', '{"data": {"genes": "a,b", "organism": "9606"}}'))
      .toBe(MimeTypes.EnrichmentTable);
    expect(refineMimeType('other.json', '{"a": 1}')).toBe('application/json');
  });

  it('recognises BioC XML and extension-less PDFs', () => {
    expect(refineMimeType('doc.xml', '<?xml version="1.0"?><collection><source>PMC</source>')).toBe(MimeTypes.BioC);
    expect(refineMimeType('doc.xml', '<?xml version="1.0"?><svg/>')).toBe('application/xml');
    expect(refineMimeType('download', '%PDF-1.7')).toBe(MimeTypes.Pdf);
  });

  it('sniffs blobs only when the name is ambiguous', async () => {
    expect(await detectMimeType('plan.json', new Blob(['{"dmp": {}}']))).toBe(MimeTypes.Dmp);
    expect(await detectMimeType('notes.txt', new Blob(['{"dmp": {}}']))).toBe('text/plain');
  });

  it('adds an extension to new files of Mycelium types', () => {
    expect(withTypeExtension('My map', MimeTypes.Map)).toBe('My map.llmap');
    expect(withTypeExtension('already.llmap', MimeTypes.Map)).toBe('already.llmap');
    expect(withTypeExtension('Samples', MimeTypes.Sdrf)).toBe('Samples.sdrf.tsv');
    expect(withTypeExtension('notes', 'text/plain')).toBe('notes');
  });
});
