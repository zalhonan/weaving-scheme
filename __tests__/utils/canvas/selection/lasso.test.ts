import { describe, it, expect } from 'vitest';
import {
  appendPoint,
  pointInPolygon,
  cellsInPolygon,
} from '../../../../src/utils/canvas/selection/lasso';
import { hasCell } from '../../../../src/utils/canvas/selection/maskUtils';

describe('lasso', () => {
  describe('appendPoint', () => {
    it('appends first point unconditionally', () => {
      const r = appendPoint([], { x: 5, y: 5 }, 5);
      expect(r).toEqual([{ x: 5, y: 5 }]);
    });
    it('skips a point closer than minDist', () => {
      const r = appendPoint([{ x: 0, y: 0 }], { x: 2, y: 2 }, 5);
      expect(r).toEqual([{ x: 0, y: 0 }]);
    });
    it('appends a point further than minDist', () => {
      const r = appendPoint([{ x: 0, y: 0 }], { x: 10, y: 0 }, 5);
      expect(r.length).toBe(2);
    });
    it('does not mutate input', () => {
      const orig = [{ x: 0, y: 0 }];
      appendPoint(orig, { x: 100, y: 100 }, 5);
      expect(orig.length).toBe(1);
    });
  });

  describe('pointInPolygon', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    it('detects inside', () => {
      expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
    });
    it('detects outside', () => {
      expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
    });
    it('returns false for degenerate polygon', () => {
      expect(pointInPolygon({ x: 1, y: 1 }, [])).toBe(false);
      expect(pointInPolygon({ x: 1, y: 1 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
    });
    it('handles concave polygon (L-shape)', () => {
      const lShape = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
        { x: 5, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 5 },
        { x: 0, y: 5 },
      ];
      // inside the L
      expect(pointInPolygon({ x: 1, y: 4 }, lShape)).toBe(true);
      expect(pointInPolygon({ x: 4, y: 1 }, lShape)).toBe(true);
      // in the notch (outside the L)
      expect(pointInPolygon({ x: 4, y: 4 }, lShape)).toBe(false);
    });
  });

  describe('cellsInPolygon', () => {
    it('selects cells whose centers are inside square', () => {
      const square = [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 4 },
      ];
      const m = cellsInPolygon(square, 10, 10);
      // cells with centers (1.5..3.5, 1.5..3.5) are inside → 3×3 = 9
      expect(m.size).toBe(9);
      expect(hasCell(m, 1, 1)).toBe(true);
      expect(hasCell(m, 3, 3)).toBe(true);
      expect(hasCell(m, 4, 4)).toBe(false);
    });
    it('clips to canvas bounds', () => {
      const big = [
        { x: -100, y: -100 },
        { x: 100, y: -100 },
        { x: 100, y: 100 },
        { x: -100, y: 100 },
      ];
      const m = cellsInPolygon(big, 3, 3);
      expect(m.size).toBe(9);
    });
    it('returns empty for degenerate polygon', () => {
      expect(cellsInPolygon([], 5, 5).size).toBe(0);
      expect(cellsInPolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }], 5, 5).size).toBe(0);
    });
  });
});
