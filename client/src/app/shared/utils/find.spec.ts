import { compileFind, tokenizeQuery } from './find';

describe('tokenizeQuery', () => {
  it('splits on spaces and keeps quoted phrases together', () => {
    expect(tokenizeQuery('tp53  "tumor protein" brca1')).toEqual(['tp53', 'tumor protein', 'brca1']);
  });

  it('keeps the whole query as one term when asked', () => {
    expect(tokenizeQuery('  tumor protein p53 ', {singleTerm: true})).toEqual(['tumor protein p53']);
  });

  it('drops empty terms', () => {
    expect(tokenizeQuery('   ""  ')).toEqual([]);
  });
});

describe('compileFind', () => {
  it('matches any of the terms, ignoring case', () => {
    const matcher = compileFind(['tp53', 'brca1']);

    expect(matcher('The TP53 gene')).toBeTrue();
    expect(matcher('brca1')).toBeTrue();
    expect(matcher('EGFR')).toBeFalse();
  });

  it('treats regular expression characters literally', () => {
    const matcher = compileFind(['a.b (c)']);

    expect(matcher('a.b (c)')).toBeTrue();
    expect(matcher('axb (c)')).toBeFalse();
  });

  it('lets every space in a phrase match a run of spaces', () => {
    const matcher = compileFind(['tumor protein p53']);

    expect(matcher('tumor protein p53')).toBeTrue();
    expect(matcher('tumor  protein  p53')).toBeTrue();
  });

  it('matches whole words only when asked', () => {
    const matcher = compileFind(['p53'], {wholeWord: true});

    expect(matcher('the p53 protein')).toBeTrue();
    expect(matcher('tp53')).toBeFalse();
  });

  it('expands wildcards only when asked', () => {
    expect(compileFind(['tp*'], {keepSearchSpecialChars: true})('tp53')).toBeTrue();
    expect(compileFind(['tp?3'], {keepSearchSpecialChars: true})('tp53')).toBeTrue();
    expect(compileFind(['tp*'])('tp53')).toBeFalse();
  });
});
