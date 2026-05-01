import { describe, it, expect } from 'vitest';
import {
  cellKey,
  parseCellKey,
  addCell,
  removeCell,
  hasCell,
  fromRect,
  union,
  subtract,
  bbox,
  translate,
  mirrorMask,
} from '../../../../src/utils/canvas/selection/maskUtils';

describe('maskUtils', () => {
  describe('cellKey / parseCellKey', () => {
    it('roundtrips positive coords', () => {
      expect(parseCellKey(cellKey(3, 4))).toEqual({ x: 3, y: 4 });
    });
    it('roundtrips zero', () => {
      expect(parseCellKey(cellKey(0, 0))).toEqual({ x: 0, y: 0 });
    });
  });

  describe('addCell / removeCell / hasCell', () => {
    it('add returns new mask with cell', () => {
      const m = addCell(new Set(), 1, 2);
      expect(hasCell(m, 1, 2)).toBe(true);
      expect(m.size).toBe(1);
    });
    it('add does not mutate input', () => {
      const m = new Set<string>();
      addCell(m, 1, 2);
      expect(m.size).toBe(0);
    });
    it('remove returns new mask without cell', () => {
      const m1 = fromRect(0, 0, 1, 0);
      const m2 = removeCell(m1, 1, 0);
      expect(hasCell(m2, 1, 0)).toBe(false);
      expect(hasCell(m2, 0, 0)).toBe(true);
    });
  });

  describe('fromRect', () => {
    it('builds inclusive rectangle', () => {
      const m = fromRect(0, 0, 2, 1);
      expect(m.size).toBe(6);
      for (let y = 0; y <= 1; y++) {
        for (let x = 0; x <= 2; x++) {
          expect(hasCell(m, x, y)).toBe(true);
        }
      }
    });
    it('handles inverted corners', () => {
      const m1 = fromRect(0, 0, 2, 1);
      const m2 = fromRect(2, 1, 0, 0);
      expect(m2).toEqual(m1);
    });
    it('single cell rect', () => {
      const m = fromRect(5, 5, 5, 5);
      expect(m.size).toBe(1);
      expect(hasCell(m, 5, 5)).toBe(true);
    });
  });

  describe('union', () => {
    it('combines two non-overlapping masks', () => {
      const a = fromRect(0, 0, 1, 0);
      const b = fromRect(3, 3, 4, 3);
      const u = union(a, b);
      expect(u.size).toBe(4);
    });
    it('deduplicates overlapping cells', () => {
      const a = fromRect(0, 0, 2, 0);
      const b = fromRect(1, 0, 3, 0);
      const u = union(a, b);
      expect(u.size).toBe(4);
    });
  });

  describe('subtract', () => {
    it('removes overlapping cells', () => {
      const a = fromRect(0, 0, 4, 0);
      const b = fromRect(1, 0, 2, 0);
      const r = subtract(a, b);
      expect(r.size).toBe(3);
      expect(hasCell(r, 0, 0)).toBe(true);
      expect(hasCell(r, 1, 0)).toBe(false);
      expect(hasCell(r, 2, 0)).toBe(false);
      expect(hasCell(r, 3, 0)).toBe(true);
      expect(hasCell(r, 4, 0)).toBe(true);
    });
    it('non-overlapping subtract returns same content', () => {
      const a = fromRect(0, 0, 1, 0);
      const b = fromRect(5, 5, 6, 5);
      const r = subtract(a, b);
      expect(r.size).toBe(2);
    });
  });

  describe('bbox', () => {
    it('returns null on empty mask', () => {
      expect(bbox(new Set())).toBe(null);
    });
    it('captures min and max', () => {
      const m = fromRect(2, 3, 5, 6);
      expect(bbox(m)).toEqual({
        minX: 2,
        minY: 3,
        maxX: 5,
        maxY: 6,
        width: 4,
        height: 4,
      });
    });
    it('handles disjoint cells', () => {
      const m = new Set<string>();
      m.add(cellKey(0, 0));
      m.add(cellKey(10, 5));
      expect(bbox(m)).toEqual({
        minX: 0,
        minY: 0,
        maxX: 10,
        maxY: 5,
        width: 11,
        height: 6,
      });
    });
  });

  describe('translate', () => {
    it('shifts every cell by (dx, dy)', () => {
      const m = fromRect(0, 0, 1, 1);
      const t = translate(m, 10, 20);
      expect(hasCell(t, 10, 20)).toBe(true);
      expect(hasCell(t, 11, 21)).toBe(true);
      expect(t.size).toBe(4);
    });
    it('does not mutate input', () => {
      const m = fromRect(0, 0, 1, 1);
      translate(m, 10, 20);
      expect(hasCell(m, 0, 0)).toBe(true);
    });
  });

  describe('mirrorMask', () => {
    it('reflects across vertical axis x = a (integer)', () => {
      const m = fromRect(0, 0, 1, 0); // cells (0,0) and (1,0)
      const r = mirrorMask(m, { orientation: 'vertical', x: 5 });
      // (0,0) → (2*5 - 0 - 1, 0) = (9, 0)
      // (1,0) → (2*5 - 1 - 1, 0) = (8, 0)
      expect(hasCell(r, 9, 0)).toBe(true);
      expect(hasCell(r, 8, 0)).toBe(true);
      expect(r.size).toBe(2);
    });
    it('reflects across vertical axis x = a (half-integer)', () => {
      const m = fromRect(0, 0, 0, 0);
      const r = mirrorMask(m, { orientation: 'vertical', x: 1.5 });
      // (0,0) → (2*1.5 - 0 - 1, 0) = (2, 0)
      expect(hasCell(r, 2, 0)).toBe(true);
    });
    it('reflects across horizontal axis y = b', () => {
      const m = fromRect(2, 1, 2, 2);
      const r = mirrorMask(m, { orientation: 'horizontal', y: 5 });
      // (2,1) → (2, 2*5 - 1 - 1) = (2, 8)
      // (2,2) → (2, 2*5 - 2 - 1) = (2, 7)
      expect(hasCell(r, 2, 8)).toBe(true);
      expect(hasCell(r, 2, 7)).toBe(true);
      expect(r.size).toBe(2);
    });
    it('mirror twice across same axis = identity', () => {
      const m = fromRect(0, 0, 2, 2);
      const axis = { orientation: 'vertical' as const, x: 5 };
      const r = mirrorMask(mirrorMask(m, axis), axis);
      expect(r).toEqual(m);
    });
  });
});
