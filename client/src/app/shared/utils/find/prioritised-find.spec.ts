import { MatchPriority, prioritisedCompileFind } from './prioritised-find';

describe('prioritisedCompileFind', () => {
  it('ranks how a single term matches', () => {
    const priority = prioritisedCompileFind(['p53'], {});

    expect(priority('p53')).toBe(MatchPriority.EXACT_MATCH);
    expect(priority('p53 protein')).toBe(MatchPriority.STARTS_WITH);
    expect(priority('tumor p53')).toBe(MatchPriority.ENDS_WITH);
    expect(priority('a p53 b')).toBe(MatchPriority.OTHER);
    expect(priority('egfr')).toBe(MatchPriority.NONE);
  });

  it('ranks each of several terms the same way', () => {
    // A term at the start must not make the whole text count as an exact match
    const priority = prioritisedCompileFind(['p53', 'brca1'], {});

    expect(priority('brca1')).toBe(MatchPriority.EXACT_MATCH);
    expect(priority('p53 protein')).toBe(MatchPriority.STARTS_WITH);
    expect(priority('tumor brca1')).toBe(MatchPriority.ENDS_WITH);
    expect(priority('the p53 protein')).toBe(MatchPriority.OTHER);
  });
});
