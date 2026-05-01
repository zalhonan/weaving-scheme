import { describe, it, expect } from 'vitest';
import { traceBoundary } from '../../../../src/utils/canvas/selection/marchingAnts';
import { fromRect, cellKey } from '../../../../src/utils/canvas/selection/maskUtils';

const segKey = (s: { x1: number; y1: number; x2: number; y2: number }) =>
  `${s.x1},${s.y1}-${s.x2},${s.y2}`;

describe('traceBoundary', () => {
  it('single cell yields 4 segments (one per edge)', () => {
    const m = fromRect(2, 3, 2, 3);
    const segs = traceBoundary(m);
    expect(segs.length).toBe(4);
    const keys = new Set(segs.map(segKey));
    expect(keys.has('2,3-3,3')).toBe(true); // top
    expect(keys.has('2,4-3,4')).toBe(true); // bottom
    expect(keys.has('2,3-2,4')).toBe(true); // left
    expect(keys.has('3,3-3,4')).toBe(true); // right
  });

  it('2x2 block: only outer edges, no interior', () => {
    const m = fromRect(0, 0, 1, 1);
    const segs = traceBoundary(m);
    // perimeter is 8 unit edges (2 per side × 4 sides)
    expect(segs.length).toBe(8);
    // interior boundaries (between (0,0) and (1,0) etc.) MUST NOT appear
    const keys = new Set(segs.map(segKey));
    expect(keys.has('1,0-1,1')).toBe(false); // interior vertical
    expect(keys.has('0,1-1,1')).toBe(false); // interior horizontal
  });

  it('1x3 row: 8 perimeter edges (3 top + 3 bottom + 1 left + 1 right)', () => {
    const m = fromRect(0, 0, 2, 0);
    const segs = traceBoundary(m);
    expect(segs.length).toBe(8);
  });

  it('disjoint cells yield independent perimeters', () => {
    const m = new Set<string>();
    m.add(cellKey(0, 0));
    m.add(cellKey(5, 5));
    const segs = traceBoundary(m);
    expect(segs.length).toBe(8); // 4 + 4
  });

  it('mask with hole emits inner perimeter too', () => {
    // 3x3 ring with hole in the middle
    const m = fromRect(0, 0, 2, 2);
    m.delete(cellKey(1, 1));
    const segs = traceBoundary(m);
    // outer perimeter = 12 unit edges
    // inner perimeter (around the missing cell) = 4
    expect(segs.length).toBe(16);
  });

  it('empty mask yields no segments', () => {
    expect(traceBoundary(new Set()).length).toBe(0);
  });
});
