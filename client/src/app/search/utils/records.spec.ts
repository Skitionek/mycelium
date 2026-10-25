import { FTSQueryRecord } from 'app/interfaces';

import { getLink } from './records';

function record(domainLabel: string, label: string, eid: string | number): FTSQueryRecord {
  return {
    node: {
      id: 1,
      label,
      data: {eid},
      subLabels: [label, domainLabel],
      displayName: 'Entity',
      domainLabels: [domainLabel],
      entityUrl: null,
    },
  };
}

describe('getLink', () => {
  it('links a UniProt protein by its accession', () => {
    expect(getLink(record('db_UniProt', 'Protein', 'P04637')))
      .toBe('https://www.uniprot.org/uniprot/P04637');
  });

  it('links a GO term by its GO identifier', () => {
    expect(getLink(record('db_GO', 'BiologicalProcess', '0006915')))
      .toBe('http://amigo.geneontology.org/amigo/term/GO:0006915');
  });

  it('does not prefix a GO identifier twice', () => {
    expect(getLink(record('db_GO', 'BiologicalProcess', 'GO:0006915')))
      .toBe('http://amigo.geneontology.org/amigo/term/GO:0006915');
  });

  it('links an NCBI gene and an NCBI taxon to their own pages', () => {
    expect(getLink(record('db_NCBI', 'Gene', 7157)))
      .toBe('https://www.ncbi.nlm.nih.gov/gene/7157');
    expect(getLink(record('db_NCBI', 'Taxonomy', 9606)))
      .toBe('https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=9606');
  });

  it('links ChEBI and MeSH entries by their identifiers', () => {
    expect(getLink(record('db_CHEBI', 'Chemical', 'CHEBI:15377')))
      .toBe('https://www.ebi.ac.uk/chebi/searchId.do?chebiId=CHEBI:15377');
    expect(getLink(record('db_MESH', 'Disease', 'D009369')))
      .toBe('https://www.ncbi.nlm.nih.gov/mesh/?term=D009369');
  });
});
