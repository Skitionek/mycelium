import { deserializePaginatedParams, getChoicesFromQuery, serializePaginatedParams } from './params';

describe('getChoicesFromQuery', () => {
  const choices = new Map([['a', 1], ['b', 2]]);

  it('answers null when the key is absent', () => {
    expect(getChoicesFromQuery({}, 'k', choices)).toBeNull();
  });

  it('answers no choices for an empty value', () => {
    expect(getChoicesFromQuery({k: ''}, 'k', choices)).toEqual([]);
  });

  it('maps known ids and drops unknown ones', () => {
    expect(getChoicesFromQuery({k: 'b;x;a'}, 'k', choices)).toEqual([2, 1]);
  });
});

describe('deserializePaginatedParams', () => {
  it('falls back to the first page and the default limit', () => {
    expect(deserializePaginatedParams({}, 25)).toEqual({page: 1, limit: 25, sort: ''});
  });

  it('reads the given values', () => {
    expect(deserializePaginatedParams({page: '3', limit: '10', sort: '-name'}, 25))
      .toEqual({page: 3, limit: 10, sort: '-name'});
  });

  it('falls back on values that are not positive integers', () => {
    expect(deserializePaginatedParams({page: 'abc', limit: '-5'}, 25))
      .toEqual({page: 1, limit: 25, sort: ''});
    expect(deserializePaginatedParams({page: '0', limit: '0'}, 25))
      .toEqual({page: 1, limit: 25, sort: ''});
  });

  it('round-trips with serializePaginatedParams', () => {
    const params = {page: 4, limit: 20, sort: 'name'};
    expect(deserializePaginatedParams(serializePaginatedParams(params, false), 50))
      .toEqual(params);
  });
});

describe('serializePaginatedParams', () => {
  it('restarts pagination when asked', () => {
    expect(serializePaginatedParams({page: 4, limit: 20, sort: 'name'}, true))
      .toEqual({page: '1', limit: '20', sort: 'name'});
  });

  it('answers defaults without params', () => {
    expect(serializePaginatedParams(null, false)).toEqual({page: '1', limit: '50', sort: ''});
  });
});
