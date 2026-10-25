import { firstValueFrom } from 'rxjs';

import { BaseEnrichmentDocument } from './enrichment-document';

const DEFAULT_DOMAINS = ['Regulon', 'UniProt', 'String', 'GO', 'BioCyc', 'KEGG'];

function load(content: string): Promise<any> {
  return firstValueFrom(new BaseEnrichmentDocument().load(new Blob([content])));
}

describe('BaseEnrichmentDocument', () => {
  it('loads a table', async () => {
    const parsed = await load(JSON.stringify({
      data: {genes: 'tp53, egfr,,tp53', taxId: '9606', organism: 'Homo sapiens', sources: ['GO', 'UniProt']},
    }));

    expect(parsed.importGenes).toEqual(['tp53', 'egfr', 'tp53']);
    expect(parsed.duplicateGenes).toEqual(['tp53']);
    expect(parsed.taxID).toBe('9606');
    expect(parsed.organism).toBe('Homo sapiens');
    expect(parsed.domains).toEqual(['GO', 'UniProt']);
  });

  it('maps species tax IDs to the strains the knowledge graph has', async () => {
    const parsed = await load(JSON.stringify({
      data: {genes: 'thrA', taxId: '562', organism: 'Escherichia coli', sources: []},
    }));

    expect(parsed.taxID).toBe('511145');
  });

  it('falls back to every domain when the table names none', async () => {
    // The table schema does not require sources
    const parsed = await load(JSON.stringify({
      data: {genes: 'tp53', taxId: '9606', organism: 'Homo sapiens'},
    }));

    expect(parsed.domains).toEqual(DEFAULT_DOMAINS);
  });

  it('loads the old slash-separated format', async () => {
    const parsed = await load('tp53,egfr/9606/Homo sapiens/GO,UniProt');

    expect(parsed.importGenes).toEqual(['tp53', 'egfr']);
    expect(parsed.taxID).toBe('9606');
    expect(parsed.organism).toBe('Homo sapiens');
    expect(parsed.domains).toEqual(['GO', 'UniProt']);
  });

  it('loads the old format for an organism whose name has slashes', async () => {
    const parsed = await load('PB1,PB2/211044/Influenza A virus (A/Puerto Rico/8/1934(H1N1))/UniProt');

    expect(parsed.taxID).toBe('211044');
    expect(parsed.organism).toBe('Influenza A virus (A/Puerto Rico/8/1934(H1N1))');
    expect(parsed.domains).toEqual(['UniProt']);
  });
});
