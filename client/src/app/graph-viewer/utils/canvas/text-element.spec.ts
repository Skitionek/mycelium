import { TextElement } from './text-element';

describe('TextElement', () => {
  /**
   * A context where every character is 6 wide, except that a hyphen after a word
   * comes out a hair wider than a hyphen alone, as kerning can make it.
   */
  const ctx = {
    font: '',
    measureText: (text: string) => ({
      width: text.length * 6 + (text.length > 1 && text.endsWith('-') ? 0.25 : 0),
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
    }),
  } as unknown as CanvasRenderingContext2D;

  function textbox(text: string, maxWidth: number, context = ctx) {
    return new TextElement(context, {text, maxWidth, font: '12px sans-serif'});
  }

  describe('a word too long for a line', () => {
    const word = 'Supercalifragilisticexpialidocious';

    it('is broken on syllables, with a hyphen at each break but not after its end', () => {
      expect(textbox(word, 54).lines.map(line => line.text))
        .toEqual(['Superca-', 'lifragi-', 'listicex-', 'pialido-', 'cious']);
      expect(textbox('tumor protein p53', 40).lines.map(line => line.text))
        .toEqual(['tumor', ' pro-', 'tein', ' p53']);
    });

    it('draws a piece that fills the line, though its hyphen comes out a hair wider', () => {
      const element = textbox(word, 54);

      expect(element.horizontalOverflow).toBeFalse();
      expect(element.lines.map(line => line.horizontalOverflow)).not.toContain(true);
    });

    it('sizes the box to fit the pieces', () => {
      const element = textbox(word, 54);

      expect(element.actualWidth).toBe(54);
      for (const line of element.lines) {
        expect(line.metrics.width).toBe(ctx.measureText(line.text).width);
        // Centred lines start within the box, give or take that hair
        expect(line.xOffset).toBeGreaterThan(-0.5);
      }
    });
  });

  describe('a word without vowels too long for a line', () => {
    it('stays whole and is marked as overflowing', () => {
      const canvas = document.createElement('canvas').getContext('2d');
      for (const context of [ctx, canvas]) {
        for (const word of ['1234567890123456789', 'GCGCGCTTTCGCGCGCGCGCGCGT']) {
          const element = textbox(word, 40, context);

          expect(element.lines.map(line => line.text)).toEqual([word]);
          expect(element.lines[0].horizontalOverflow).toBeTrue();
          expect(element.horizontalOverflow).toBeTrue();
        }
      }
    });
  });

  it('keeps short text on one line', () => {
    const element = textbox('TP53', 100);

    expect(element.lines.map(line => line.text)).toEqual(['TP53']);
    expect(element.horizontalOverflow).toBeFalse();
  });
});
