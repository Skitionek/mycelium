import { SimpleChange } from '@angular/core';

import { TermHighlightComponent } from './term-highlight.component';

function highlight(text: string, highlightTerms: string[], highlightOptions = {}): string {
  const component = new TermHighlightComponent();
  Object.assign(component, {text, highlightTerms, highlightOptions});
  component.ngOnChanges({
    text: new SimpleChange(undefined, text, true),
    highlightTerms: new SimpleChange(undefined, highlightTerms, true),
  });
  return component.highlight;
}

describe('TermHighlightComponent', () => {
  it('wraps every match of every term', () => {
    expect(highlight('MAPK1 and mapk1 reduce tumour growth', ['MAPK1', 'tumour']))
      .toBe('<snippet><highlight>MAPK1</highlight> and <highlight>mapk1</highlight> reduce ' +
        '<highlight>tumour</highlight> growth</snippet>');
  });

  it('matches whole words only when asked', () => {
    expect(highlight('MAPK1 and MAPK12', ['MAPK1'], {wholeWord: true}))
      .toBe('<snippet><highlight>MAPK1</highlight> and MAPK12</snippet>');
  });

  it('expands wildcards', () => {
    expect(highlight('MAPK12 kinase', ['MAPK*']))
      .toBe('<snippet><highlight>MAPK12</highlight> kinase</snippet>');
  });

  it('escapes the text', () => {
    expect(highlight('<b>MAPK1</b>', ['MAPK1']))
      .toBe('<snippet>&lt;b&gt;<highlight>MAPK1</highlight>&lt;/b&gt;</snippet>');
  });

  it('finds terms holding characters that are escaped', () => {
    expect(highlight('R&D on "TP53"', ['R&D', '"TP53"']))
      .toBe('<snippet><highlight>R&amp;D</highlight> on <highlight>&quot;TP53&quot;</highlight></snippet>');
  });

  it('never matches inside the escaping of other characters', () => {
    expect(highlight('salt & pepper', ['amp', 'pepper']))
      .toBe('<snippet>salt &amp; <highlight>pepper</highlight></snippet>');
  });

  it('ignores empty terms', () => {
    expect(highlight('MAPK1 kinase', ['', 'kinase']))
      .toBe('<snippet>MAPK1 <highlight>kinase</highlight></snippet>');
    expect(highlight('MAPK1 kinase', [''])).toBeNull();
  });

  it('highlights nothing without terms', () => {
    expect(highlight('MAPK1', [])).toBeNull();
  });
});
