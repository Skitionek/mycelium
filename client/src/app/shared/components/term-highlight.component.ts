import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

import { escape, escapeRegExp, isNil } from 'lodash-es';

import { FindOptions } from 'app/shared/utils/find';

@Component({
  selector: 'app-term-highlight',
  templateUrl: 'term-highlight.component.html',
})
export class TermHighlightComponent implements OnChanges {
  @Input() text = '';
  @Input() highlightTerms: string[] = [];
  @Input() highlightOptions: FindOptions = {};
  highlight: string;

  ngOnChanges(changes: SimpleChanges) {
    if ('highlightTerms' in changes || 'text' in changes) {
      // An empty term would match between every two characters
      const terms = (this.highlightTerms || []).filter(term => term.length);
      if (!isNil(this.text) && terms.length > 0) {
        const phrasePatterns = terms.map(
          phrase => escapeRegExp(phrase)
            .replace(/ +/g, ' +')
            .replace(/(\\\*)/g, '\\w*')
            .replace(/(\\\?)/g, '\\w?'),
        ).join('|');
        const pattern = this.highlightOptions.wholeWord ? `\\b(${phrasePatterns})\\b` : `(${phrasePatterns})`;
        const regex = new RegExp(pattern, 'gi');
        // Matched on the text itself and escaped piece by piece: matching the escaped
        // text would find terms inside '&amp;' and miss terms holding '&' or '<'
        let highlighted = '';
        let end = 0;
        for (const match of this.text.matchAll(regex)) {
          highlighted += escape(this.text.slice(end, match.index)) + '<highlight>' + escape(match[0]) + '</highlight>';
          end = match.index + match[0].length;
        }
        this.highlight = '<snippet>' + highlighted + escape(this.text.slice(end)) + '</snippet>';
      } else {
        this.highlight = null;
      }
    }
  }
}
