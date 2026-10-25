import { TextElement } from './text-element';

describe('TextElement', () => {
  const font = '12px sans-serif';
  const ctx = document.createElement('canvas').getContext('2d');

  function textbox(text: string, maxWidth: number) {
    return new TextElement(ctx, {text, maxWidth, font});
  }

  describe('a word too long for a line', () => {
    const word = 'Supercalifragilisticexpialidocious';
    const maxWidth = 60;

    it('is broken on syllables, with a hyphen at each break', () => {
      const lines = textbox(word, maxWidth).lines.map(line => line.text);

      expect(lines.length).toBeGreaterThan(1);
      expect(lines.slice(0, -1).every(line => line.endsWith('-'))).toBeTrue();
      expect(lines.map(line => line.replace(/-$/, '')).join('')).toBe(word);
    });

    it('gets no hyphen after its last piece', () => {
      const lines = textbox(word, maxWidth).lines.map(line => line.text);

      expect(lines[lines.length - 1]).toBe('cious');
      expect(textbox('tumor protein p53', 40).lines.map(line => line.text)).not.toContain('tein-');
    });

    it('sizes the box to fit the pieces', () => {
      const element = textbox(word, maxWidth);
      const widest = Math.max(...element.lines.map(line => line.metrics.width));

      expect(element.horizontalOverflow).toBeFalse();
      expect(element.actualWidth).toBe(widest);
      expect(widest).toBeLessThanOrEqual(maxWidth);
      for (const line of element.lines) {
        // Centred lines start within the box, not to the left of it
        expect(line.xOffset).toBeGreaterThanOrEqual(0);
        ctx.font = font;
        expect(line.metrics.width).toBe(ctx.measureText(line.text).width);
      }
    });
  });

  describe('a word without vowels too long for a line', () => {
    it('stays whole and is marked as overflowing', () => {
      for (const word of ['1234567890123456789', 'GCGCGCTTTCGCGCGCGCGCGCGT']) {
        const element = textbox(word, 40);

        expect(element.lines.map(line => line.text)).toEqual([word]);
        expect(element.lines[0].horizontalOverflow).toBeTrue();
        expect(element.horizontalOverflow).toBeTrue();
      }
    });
  });

  it('keeps short text on one line', () => {
    const element = textbox('TP53', 100);

    expect(element.lines.map(line => line.text)).toEqual(['TP53']);
    expect(element.horizontalOverflow).toBeFalse();
  });
});
