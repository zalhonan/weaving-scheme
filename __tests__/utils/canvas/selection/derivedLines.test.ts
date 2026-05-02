import { describe, it, expect } from 'vitest';
import { getLinesInMask } from '../../../../src/utils/canvas/selection/derivedLines';
import { fromRect } from '../../../../src/utils/canvas/selection/maskUtils';
import { getLineKey } from '../../../../src/types';
import type { Line } from '../../../../src/types';

const makeLines = (entries: Array<Omit<Line, 'color'>>): Map<string, Line> => {
  const m = new Map<string, Line>();
  for (const e of entries) {
    const line: Line = { ...e, color: '#000' };
    m.set(getLineKey(e.x, e.y, e.orientation), line);
  }
  return m;
};

describe('getLinesInMask', () => {
  it('returns empty for empty mask', () => {
    const lines = makeLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    expect(getLinesInMask(new Set(), lines)).toEqual([]);
  });

  it('includes all 4 edges of a single-cell selection (inclusive boundary)', () => {
    const mask = fromRect(2, 3, 2, 3);
    const lines = makeLines([
      { x: 2, y: 3, orientation: 'horizontal' }, // top edge
      { x: 2, y: 4, orientation: 'horizontal' }, // bottom edge
      { x: 2, y: 3, orientation: 'vertical' },   // left edge
      { x: 3, y: 3, orientation: 'vertical' },   // right edge
      { x: 5, y: 5, orientation: 'horizontal' }, // unrelated
    ]);
    const result = getLinesInMask(mask, lines);
    expect(result.length).toBe(4);
    const keys = new Set(result.map((l) => getLineKey(l.x, l.y, l.orientation)));
    expect(keys.has(getLineKey(2, 3, 'horizontal'))).toBe(true);
    expect(keys.has(getLineKey(2, 4, 'horizontal'))).toBe(true);
    expect(keys.has(getLineKey(2, 3, 'vertical'))).toBe(true);
    expect(keys.has(getLineKey(3, 3, 'vertical'))).toBe(true);
  });

  it('horizontal line on perimeter of 2x2 selection is included', () => {
    const mask = fromRect(0, 0, 1, 1);
    const lines = makeLines([
      { x: 0, y: 0, orientation: 'horizontal' }, // top-left top edge
      { x: 1, y: 0, orientation: 'horizontal' }, // top-right top edge
      { x: 0, y: 2, orientation: 'horizontal' }, // bottom-left bottom edge
      { x: 1, y: 2, orientation: 'horizontal' }, // bottom-right bottom edge
      { x: 0, y: 1, orientation: 'horizontal' }, // interior horizontal line
    ]);
    const result = getLinesInMask(mask, lines);
    expect(result.length).toBe(5);
  });

  it('excludes lines fully outside mask', () => {
    const mask = fromRect(0, 0, 0, 0);
    const lines = makeLines([
      { x: 5, y: 5, orientation: 'horizontal' },
      { x: 5, y: 5, orientation: 'vertical' },
    ]);
    expect(getLinesInMask(mask, lines).length).toBe(0);
  });

  it('handles disjoint mask (two cells far apart) correctly', () => {
    const mask = new Set<string>();
    mask.add('0:0');
    mask.add('5:5');
    const lines = makeLines([
      // edges of cell (0,0)
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 0, y: 1, orientation: 'horizontal' },
      { x: 0, y: 0, orientation: 'vertical' },
      { x: 1, y: 0, orientation: 'vertical' },
      // edges of cell (5,5)
      { x: 5, y: 5, orientation: 'horizontal' },
      { x: 5, y: 6, orientation: 'horizontal' },
      { x: 5, y: 5, orientation: 'vertical' },
      { x: 6, y: 5, orientation: 'vertical' },
      // unrelated
      { x: 2, y: 2, orientation: 'horizontal' },
    ]);
    const result = getLinesInMask(mask, lines);
    expect(result.length).toBe(8);
  });
});
