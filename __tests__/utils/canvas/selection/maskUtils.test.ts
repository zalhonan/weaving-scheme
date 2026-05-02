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
  clipMaskToCanvas,
  rotateMask,
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

  describe('clipMaskToCanvas', () => {
    it('keeps cells in [0,width-1] × [0,height-1]', () => {
      const m = new Set<string>();
      m.add(cellKey(0, 0));
      m.add(cellKey(4, 4));
      m.add(cellKey(5, 5));    // out: equals width/height
      m.add(cellKey(-1, 0));   // out: negative
      m.add(cellKey(0, -1));   // out: negative
      m.add(cellKey(10, 10));  // out: way past
      const r = clipMaskToCanvas(m, 5, 5);
      expect(r.size).toBe(2);
      expect(hasCell(r, 0, 0)).toBe(true);
      expect(hasCell(r, 4, 4)).toBe(true);
    });
    it('returns empty for fully off-canvas mask', () => {
      const m = new Set<string>();
      m.add(cellKey(100, 100));
      const r = clipMaskToCanvas(m, 5, 5);
      expect(r.size).toBe(0);
    });
  });

  describe('rotateMask', () => {
    it('CW rotates top-left to top-right in a 2x2 bbox', () => {
      // 2x2 bbox: cells (0..1, 0..1), center (1, 1).
      const m = fromRect(0, 0, 0, 0); // top-left only
      const r = rotateMask(m, 'cw', 1, 1);
      expect(hasCell(r, 1, 0)).toBe(true);
      expect(r.size).toBe(1);
    });

    it('four CW rotations restore the original (square bbox)', () => {
      const m = fromRect(0, 0, 1, 1);
      let r = m;
      for (let i = 0; i < 4; i++) r = rotateMask(r, 'cw', 1, 1);
      expect(r).toEqual(m);
    });

    it('CCW is inverse of CW for square bbox', () => {
      const m = fromRect(0, 0, 1, 1);
      const back = rotateMask(rotateMask(m, 'cw', 1, 1), 'ccw', 1, 1);
      expect(back).toEqual(m);
    });

    it('non-square bbox produces integer cell coords (rounded)', () => {
      // 4x2 bbox: cells (0..3, 0..1), center (2, 1).
      const m = fromRect(0, 0, 3, 1);
      const r = rotateMask(m, 'cw', 2, 1);
      // All result keys must be integer-coord cells
      for (const k of r) {
        const { x, y } = parseCellKey(k);
        expect(Number.isInteger(x)).toBe(true);
        expect(Number.isInteger(y)).toBe(true);
      }
      // Width and height swap: 4x2 bbox → 2x4 bbox after rotation
      const b = bbox(r);
      expect(b!.width).toBe(2);
      expect(b!.height).toBe(4);
    });

    it('square bbox with half-integer center (3x3) rotates without rounding loss', () => {
      // 3x3 bbox: cells (0..2, 0..2), center (1.5, 1.5).
      const m = fromRect(0, 0, 2, 2);
      let r = m;
      for (let i = 0; i < 4; i++) r = rotateMask(r, 'cw', 1.5, 1.5);
      expect(r).toEqual(m);
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
