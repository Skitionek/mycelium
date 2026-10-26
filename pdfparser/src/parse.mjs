/**
 * Core PDF parsing logic using pdf.js.
 *
 * This module has zero Node.js-specific imports and can be bundled
 * for the browser as-is. The caller supplies the pdf.js module so
 * the import path (legacy Node build vs. browser build) stays outside.
 *
 * @module parse
 */

/**
 * Extract word-level tokens with bounding boxes from a PDF.
 *
 * Returns the same JSON shape as the legacy lifelike-pdfparser service
 * so the appserver needs no schema changes.
 *
 * @param {Uint8Array} data - raw PDF bytes
 * @param {object}    pdfjsLib - the pdfjs-dist module (injected by the caller)
 * @returns {Promise<{pages: Array}>}
 */
export async function parsePdf(data, pdfjsLib) {
  const loadingTask = pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    let pageText = '';
    const tokens = [];
    let charIndex = 0;

    for (const item of textContent.items) {
      // TextMarkedContent items have no str
      if (typeof item.str !== 'string') continue;

      const str = item.str;
      // transform = [a, b, c, d, x, y] affine matrix; (x, y) is baseline origin
      const [a, b, , , x, y] = item.transform;
      const rotation = Math.round(Math.atan2(b, a) * 180 / Math.PI);
      const itemWidth = item.width ?? 0;
      // item.height is the font em-size (ascent only); add ~25% for descenders
      const itemHeight = (item.height ?? Math.hypot(a, b)) * 1.25;
      const ascent = itemHeight * 0.8;

      // Split into individual words; track each word's char offset within the item
      for (const match of str.matchAll(/\S+/g)) {
        const word = match[0];
        const wordStart = match.index;

        // Linearly interpolate the word's x position within the item by char ratio
        const startRatio = str.length > 0 ? wordStart / str.length : 0;
        const widthRatio = str.length > 0 ? word.length / str.length : 0;
        const cosR = Math.cos(rotation * Math.PI / 180);
        const sinR = Math.sin(rotation * Math.PI / 180);
        const wordX = x + startRatio * itemWidth * cosR;
        const wordY = y + startRatio * itemWidth * sinR;
        const wordWidth = widthRatio * itemWidth;

        tokens.push({
          text: word,
          pgIdx: charIndex + wordStart,
          possibleAbbrev: false,
          rects: [{
            lowerLeftPt: { x: wordX, y: wordY },
            pivotPt: { x: wordX, y: wordY + ascent },
            width: wordWidth,
            height: itemHeight,
            rotation,
          }],
          shapes: [],
        });
      }

      pageText += str;
      charIndex += str.length;

      if (item.hasEOL) {
        pageText += '\n';
        charIndex += 1;
      }
    }

    pages.push({
      pageNo: pageNum,
      pageText,
      tokens,
    });
  }

  return { pages };
}

/**
 * Tokenise plain text into word tokens (no bounding boxes).
 * Used for enrichment tables and other non-PDF plain-text content.
 *
 * @param {string} text
 * @returns {{pages: Array}}
 */
export function parseText(text) {
  const tokens = [];

  for (const match of text.matchAll(/\S+/g)) {
    tokens.push({
      text: match[0],
      pgIdx: match.index,
      possibleAbbrev: false,
      rects: [],
      shapes: [],
    });
  }

  return {
    pages: [{
      pageNo: 1,
      pageText: text,
      tokens,
    }],
  };
}
