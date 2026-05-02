import { describe, it, expect } from 'vitest';
import {
  translateLines,
  mirrorLines,
  normalizeToOrigin,
  linesBbox,
  clipLinesToCanvas,
} from '../../../../src/utils/canvas/selection/transforms';
import type { Line, MirrorAxis } from '../../../../src/types';

const L = (x: number, y: number, orientation: 'horizontal' | 'vertical', color = '#000'): Line => ({
  x,
  y,
  orientation,
  color,
});

describe('translateLines', () => {
  it('shifts every line by (dx, dy) preserving orientation and color', () => {
    const lines = [L(1, 2, 'horizontal', '#fff'), L(3, 4, 'vertical', '#abc')];
    const r = translateLines(lines, 10, 20);
    expect(r).toEqual([
      { x: 11, y: 22, orientation: 'horizontal', color: '#fff' },
      { x: 13, y: 24, orientation: 'vertical', color: '#abc' },
    ]);
  });
  it('does not mutate input', () => {
    const lines = [L(1, 2, 'horizontal')];
    translateLines(lines, 5, 5);
    expect(lines[0].x).toBe(1);
  });
});

describe('mirrorLines', () => {
  describe('vertical axis', () => {
    const axis: MirrorAxis = { orientation: 'vertical', x: 5 };

    it('reflects horizontal line: new x = 2a - x - 1', () => {
      const r = mirrorLines([L(2, 3, 'horizontal')], axis);
      expect(r[0].x).toBe(2 * 5 - 2 - 1); // 7
      expect(r[0].y).toBe(3);
      expect(r[0].orientation).toBe('horizontal');
    });

    it('reflects vertical line: new x = 2a - x', () => {
      const r = mirrorLines([L(2, 3, 'vertical')], axis);
      expect(r[0].x).toBe(2 * 5 - 2); // 8
      expect(r[0].y).toBe(3);
      expect(r[0].orientation).toBe('vertical');
    });

    it('a horizontal line on the axis reflects symmetrically', () => {
      // horizontal line at x=4 spans [4,5] so is just left of axis x=5
      // reflected: x = 5; spans [5,6] just right
      const r = mirrorLines([L(4, 0, 'horizontal')], axis);
      expect(r[0].x).toBe(5);
    });
  });

  describe('horizontal axis', () => {
    const axis: MirrorAxis = { orientation: 'horizontal', y: 5 };

    it('reflects horizontal line: new y = 2b - y', () => {
      const r = mirrorLines([L(2, 3, 'horizontal')], axis);
      expect(r[0].y).toBe(2 * 5 - 3); // 7
      expect(r[0].x).toBe(2);
      expect(r[0].orientation).toBe('horizontal');
    });

    it('reflects vertical line: new y = 2b - y - 1', () => {
      const r = mirrorLines([L(2, 3, 'vertical')], axis);
      expect(r[0].y).toBe(2 * 5 - 3 - 1); // 6
      expect(r[0].x).toBe(2);
      expect(r[0].orientation).toBe('vertical');
    });
  });

  it('preserves orientation (mirror is not rotation)', () => {
    const axis: MirrorAxis = { orientation: 'vertical', x: 5 };
    const r = mirrorLines(
      [L(0, 0, 'horizontal'), L(0, 0, 'vertical')],
      axis,
    );
    expect(r[0].orientation).toBe('horizontal');
    expect(r[1].orientation).toBe('vertical');
  });

  it('half-integer axis (bbox-center preset for odd-width selection)', () => {
    // bbox 0..2 → vertical center axis at x = 1.5
    const axis: MirrorAxis = { orientation: 'vertical', x: 1.5 };
    // horizontal line at x=0 spans [0,1] → reflected: 2*1.5 - 0 - 1 = 2 → spans [2,3]
    const r = mirrorLines([L(0, 0, 'horizontal')], axis);
    expect(r[0].x).toBe(2);
  });

  it('preserves color', () => {
    const r = mirrorLines(
      [L(0, 0, 'horizontal', '#abc')],
      { orientation: 'vertical', x: 5 },
    );
    expect(r[0].color).toBe('#abc');
  });
});

describe('normalizeToOrigin', () => {
  it('shifts so min(x), min(y) become 0', () => {
    const r = normalizeToOrigin([L(3, 5, 'horizontal'), L(4, 6, 'vertical')]);
    expect(r).toEqual([
      { x: 0, y: 0, orientation: 'horizontal', color: '#000' },
      { x: 1, y: 1, orientation: 'vertical', color: '#000' },
    ]);
  });
  it('handles empty', () => {
    expect(normalizeToOrigin([])).toEqual([]);
  });
});

describe('clipLinesToCanvas', () => {
  it('keeps in-bounds lines (horizontal x ∈ [0,width-1], y ∈ [0,height])', () => {
    const lines = [
      L(0, 0, 'horizontal'),       // top-left edge: in
      L(4, 5, 'horizontal'),       // bottom edge of last row: in
      L(5, 0, 'horizontal'),       // x = width: out (must be < width)
      L(-1, 0, 'horizontal'),      // negative x: out
      L(0, -1, 'horizontal'),      // negative y: out
      L(0, 6, 'horizontal'),       // y > height: out
    ];
    const r = clipLinesToCanvas(lines, 5, 5);
    expect(r.length).toBe(2);
  });
  it('keeps in-bounds vertical lines (x ∈ [0,width], y ∈ [0,height-1])', () => {
    const lines = [
      L(0, 0, 'vertical'),         // left edge: in
      L(5, 4, 'vertical'),         // right edge of last col: in
      L(0, 5, 'vertical'),         // y = height: out
      L(6, 0, 'vertical'),         // x > width: out
    ];
    const r = clipLinesToCanvas(lines, 5, 5);
    expect(r.length).toBe(2);
  });
  it('returns empty when everything is off-canvas', () => {
    const r = clipLinesToCanvas(
      [L(100, 100, 'horizontal'), L(-50, -50, 'vertical')],
      10,
      10,
    );
    expect(r.length).toBe(0);
  });
});

describe('linesBbox', () => {
  it('returns null for empty', () => {
    expect(linesBbox([])).toBe(null);
  });
  it('captures min/max', () => {
    expect(linesBbox([L(2, 3, 'horizontal'), L(5, 7, 'vertical')])).toEqual({
      minX: 2,
      minY: 3,
      maxX: 5,
      maxY: 7,
    });
  });
});
