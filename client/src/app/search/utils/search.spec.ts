import { VIZ_SEARCH_LIMIT } from 'app/shared/constants';

import { SearchType } from '../shared';
import {
  createContentSearchParamsFromQuery,
  createGraphSearchParamsFromQuery,
  getContentSearchQueryParams,
  getGraphQueryParams,
} from './search';

describe('graph search query params', () => {
  // What the search form emits: no page, as a new search starts on the first
  function roundTrip(params) {
    return createGraphSearchParamsFromQuery(getGraphQueryParams(params));
  }

  it('keeps the organism', () => {
    expect(roundTrip({query: 'p53', domains: [], entities: [], organism: '9606'}).organism)
      .toBe('9606');
  });

  it('keeps the domains and entities', () => {
    const params = roundTrip({query: 'p53', domains: ['ChEBI', 'GO'], entities: ['Gene'], organism: ''});

    expect(params.domains).toEqual(['ChEBI', 'GO']);
    expect(params.entities).toEqual(['Gene']);
  });

  it('reads no domains or entities as none, not as one named ""', () => {
    const params = roundTrip({query: 'p53', domains: [], entities: [], organism: ''});

    expect(params.domains).toEqual([]);
    expect(params.entities).toEqual([]);
  });

  it('starts a search without a page on the first page', () => {
    const queryParams = getGraphQueryParams({query: 'p53', domains: [], entities: [], organism: ''});

    expect(queryParams.page).toBe('1');
    expect(createGraphSearchParamsFromQuery(queryParams).page).toBe(1);
  });

  it('keeps the page', () => {
    expect(roundTrip({query: 'p53', page: 3}).page).toBe(3);
  });

  it('uses the visualizer page size', () => {
    expect(roundTrip({query: 'p53', limit: 500}).limit).toBe(VIZ_SEARCH_LIMIT);
  });
});

describe('content search query params', () => {
  const pdf: SearchType = {id: 'application/pdf', shorthand: 'pdf', name: 'Documents'};
  const options = {defaultLimit: 20, searchTypesMap: new Map([[pdf.shorthand, pdf]])};

  function roundTrip(params) {
    return createContentSearchParamsFromQuery(getContentSearchQueryParams(params), options);
  }

  it('keeps the folders', () => {
    expect(roundTrip({q: 'p53', folders: ['abc', 'def']}).folders).toEqual(['abc', 'def']);
  });

  it('reads no folders as none, not as one named ""', () => {
    expect(roundTrip({q: 'p53', folders: [], types: []}).folders).toEqual([]);
  });

  it('keeps the types', () => {
    expect(roundTrip({q: 'p53', types: [pdf]}).types).toEqual([pdf]);
  });

  it('keeps the query', () => {
    expect(roundTrip({q: 'p53'}).q).toBe('p53');
  });
});
