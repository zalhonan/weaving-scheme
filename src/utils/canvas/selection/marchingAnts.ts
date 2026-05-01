import type { SelectionMask } from '../../../types';
import { hasCell, parseCellKey } from './maskUtils';

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Trace the perimeter of the mask in grid coordinates. Each emitted segment
 * is a unit-length grid edge between an "in" cell and an "out" neighbor.
 * Holes and disjoint regions are handled correctly because we emit one
 * segment per (in-cell, out-neighbor) pair.
 *
 * Coordinate convention: a cell at integer grid position (x, y) occupies the
 * square [x, x+1] × [y, y+1]. The four edges are:
 *   - Top:    (x, y)     → (x+1, y)
 *   - Bottom: (x, y+1)   → (x+1, y+1)
 *   - Left:   (x, y)     → (x, y+1)
 *   - Right:  (x+1, y)   → (x+1, y+1)
 */
export const traceBoundary = (mask: SelectionMask): Segment[] => {
  const segments: Segment[] = [];
  for (const k of mask) {
    const { x, y } = parseCellKey(k);
    if (!hasCell(mask, x, y - 1)) {
      segments.push({ x1: x, y1: y, x2: x + 1, y2: y });
    }
    if (!hasCell(mask, x, y + 1)) {
      segments.push({ x1: x, y1: y + 1, x2: x + 1, y2: y + 1 });
    }
    if (!hasCell(mask, x - 1, y)) {
      segments.push({ x1: x, y1: y, x2: x, y2: y + 1 });
    }
    if (!hasCell(mask, x + 1, y)) {
      segments.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 });
    }
  }
  return segments;
};
