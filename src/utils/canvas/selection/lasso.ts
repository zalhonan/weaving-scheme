import type { SelectionMask } from '../../../types';
import { cellKey } from './maskUtils';

export interface Point {
  x: number;
  y: number;
}

/**
 * Append a new point to the polygon if it lies at least `minDist` (in the
 * same units as `points`) away from the previous accepted point. Used during
 * drag-collection to suppress jitter without losing fidelity.
 *
 * Distances are intended to be in screen pixels: callers should convert
 * grid coordinates → screen before calling, or pass `minDist` in grid units.
 */
export const appendPoint = (
  points: Point[],
  newPoint: Point,
  minDist: number = 5,
): Point[] => {
  if (points.length === 0) return [newPoint];
  const last = points[points.length - 1];
  const dx = newPoint.x - last.x;
  const dy = newPoint.y - last.y;
  if (dx * dx + dy * dy < minDist * minDist) return points;
  return [...points, newPoint];
};

/**
 * Standard ray-casting point-in-polygon test. Returns false for polygons
 * with fewer than 3 vertices.
 */
export const pointInPolygon = (point: Point, polygon: Point[]): boolean => {
  if (polygon.length < 3) return false;
  let inside = false;
  const { x, y } = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Build a SelectionMask from a polygon (in grid-cell coordinates) by testing
 * each cell's center. Cells outside the canvas are skipped.
 */
export const cellsInPolygon = (
  polygon: Point[],
  width: number,
  height: number,
): SelectionMask => {
  const mask = new Set<string>();
  if (polygon.length < 3) return mask;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const x0 = Math.max(0, Math.floor(minX));
  const x1 = Math.min(width - 1, Math.ceil(maxX));
  const y0 = Math.max(0, Math.floor(minY));
  const y1 = Math.min(height - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (pointInPolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) {
        mask.add(cellKey(x, y));
      }
    }
  }
  return mask;
};
