import { PageViewport } from 'pdfjs-dist/types/src/display/page_viewport';

/**
 * Polyfill for PageViewport.convertToViewportRectangle, removed in pdfjs-dist v6.
 * Takes a PDF-space rect [x1, y1, x2, y2] and returns viewport-space [x1, y1, x2, y2].
 */
export function convertToViewportRectangle(viewport: PageViewport, rect: number[]): number[] {
  const p1 = viewport.convertToViewportPoint(rect[0], rect[1]);
  const p2 = viewport.convertToViewportPoint(rect[2], rect[3]);
  return [p1[0], p1[1], p2[0], p2[1]];
}
