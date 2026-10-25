import { LineEdge } from './line-edge';

describe('LineEdge', () => {
  const ctx = {} as CanvasRenderingContext2D;

  function edge(source: { x: number, y: number }, target: { x: number, y: number }) {
    return new LineEdge(ctx, {source, target});
  }

  describe('isPointIntersecting', () => {
    it('hits a point on an edge that runs down and to the right', () => {
      expect(edge({x: 0, y: 0}, {x: 100, y: 100}).isPointIntersecting(25, 25)).toBeTrue();
    });

    it('hits a point on an edge that runs up and to the right', () => {
      expect(edge({x: 0, y: 100}, {x: 100, y: 0}).isPointIntersecting(25, 75)).toBeTrue();
    });

    it('misses the other diagonal of the box an edge spans', () => {
      const rising = edge({x: 0, y: 100}, {x: 100, y: 0});

      expect(rising.isPointIntersecting(25, 25)).toBeFalse();
      expect(rising.isPointIntersecting(75, 75)).toBeFalse();
    });

    it('hits a point on a vertical edge', () => {
      expect(edge({x: 50, y: 0}, {x: 50, y: 100}).isPointIntersecting(50, 40)).toBeTrue();
      expect(edge({x: 50, y: 0}, {x: 50, y: 100}).isPointIntersecting(51, 40)).toBeTrue();
    });

    it('hits a point on a horizontal edge', () => {
      expect(edge({x: 0, y: 50}, {x: 100, y: 50}).isPointIntersecting(40, 51)).toBeTrue();
    });

    it('misses a point well off the edge', () => {
      expect(edge({x: 0, y: 50}, {x: 100, y: 50}).isPointIntersecting(40, 60)).toBeFalse();
      expect(edge({x: 50, y: 0}, {x: 50, y: 100}).isPointIntersecting(60, 40)).toBeFalse();
    });

    it('misses a point past the end of the edge', () => {
      expect(edge({x: 0, y: 0}, {x: 100, y: 100}).isPointIntersecting(120, 120)).toBeFalse();
    });
  });

  describe('getPointDistanceUnsq', () => {
    it('measures the squared distance to the nearest point of the edge', () => {
      const horizontal = edge({x: 0, y: 50}, {x: 100, y: 50});

      expect(horizontal.getPointDistanceUnsq(40, 53)).toBe(9);
      expect(horizontal.getPointDistanceUnsq(103, 54)).toBe(25);
    });
  });
});
