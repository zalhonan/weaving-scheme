import type { RotationDirection, SelectionMask } from '../../../types';

// `:` separator (not `-`) so negative coordinates round-trip cleanly through
// `cellKey` ↔ `parseCellKey`. SelectionMask is in-memory only, so this format
// has no persistence implications.
export const cellKey = (x: number, y: number): string => `${x}:${y}`;

export const parseCellKey = (key: string): { x: number; y: number } => {
  const [xs, ys] = key.split(':');
  return { x: Number(xs), y: Number(ys) };
};

export const addCell = (mask: SelectionMask, x: number, y: number): SelectionMask => {
  const next = new Set(mask);
  next.add(cellKey(x, y));
  return next;
};

export const removeCell = (mask: SelectionMask, x: number, y: number): SelectionMask => {
  const next = new Set(mask);
  next.delete(cellKey(x, y));
  return next;
};

export const hasCell = (mask: SelectionMask, x: number, y: number): boolean =>
  mask.has(cellKey(x, y));

/**
 * Build a rectangular mask from two opposite cell corners (inclusive on both).
 * Order of corners does not matter.
 */
export const fromRect = (
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): SelectionMask => {
  const mask = new Set<string>();
  const minX = Math.min(x0, x1);
  const maxX = Math.max(x0, x1);
  const minY = Math.min(y0, y1);
  const maxY = Math.max(y0, y1);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      mask.add(cellKey(x, y));
    }
  }
  return mask;
};

export const union = (a: SelectionMask, b: SelectionMask): SelectionMask => {
  const next = new Set(a);
  for (const k of b) next.add(k);
  return next;
};

export const subtract = (a: SelectionMask, b: SelectionMask): SelectionMask => {
  const next = new Set(a);
  for (const k of b) next.delete(k);
  return next;
};

export interface MaskBbox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export const bbox = (mask: SelectionMask): MaskBbox | null => {
  if (mask.size === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const k of mask) {
    const { x, y } = parseCellKey(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

export const translate = (mask: SelectionMask, dx: number, dy: number): SelectionMask => {
  const next = new Set<string>();
  for (const k of mask) {
    const { x, y } = parseCellKey(k);
    next.add(cellKey(x + dx, y + dy));
  }
  return next;
};

/**
 * Rotate a cell mask 90° around pivot `(cx, cy)`. Screen coordinates
 * (y-down). For non-square bboxes (half-integer pivot), results are rounded
 * to the nearest integer cell.
 *
 *   CW : (x, y) → (cx + cy − y − 1, x + cy − cx)
 *   CCW: (x, y) → (cx + y − cy, cy + cx − x − 1)
 */
export const rotateMask = (
  mask: SelectionMask,
  direction: RotationDirection,
  cx: number,
  cy: number,
): SelectionMask => {
  const next = new Set<string>();
  for (const k of mask) {
    const { x, y } = parseCellKey(k);
    let nx: number;
    let ny: number;
    if (direction === 'cw') {
      nx = cx + cy - y - 1;
      ny = x + cy - cx;
    } else {
      nx = cx + y - cy;
      ny = cy + cx - x - 1;
    }
    next.add(cellKey(Math.round(nx), Math.round(ny)));
  }
  return next;
};

/**
 * Drop cells that lie outside the canvas. Used at commit time so that a
 * destMask dragged partly off-canvas doesn't leave the post-commit selection
 * in an out-of-range state.
 */
export const clipMaskToCanvas = (
  mask: SelectionMask,
  width: number,
  height: number,
): SelectionMask => {
  const next = new Set<string>();
  for (const k of mask) {
    const { x, y } = parseCellKey(k);
    if (x >= 0 && x < width && y >= 0 && y < height) next.add(k);
  }
  return next;
};

/**
 * Mirror a cell mask across an axis.
 *
 * Cell (cx, cy) occupies the square [cx, cx+1] × [cy, cy+1].
 *
 * Vertical axis x = a (column boundary):
 *   reflected cell = (2a − cx − 1, cy)
 *
 * Horizontal axis y = b (row boundary):
 *   reflected cell = (cx, 2b − cy − 1)
 *
 * `a` and `b` may be half-integers (e.g. for bbox-center presets) — the
 * formulas still yield integer cell coordinates because `2 * 1.5 = 3`.
 */
export const mirrorMask = (
  mask: SelectionMask,
  axis: { orientation: 'vertical'; x: number } | { orientation: 'horizontal'; y: number },
): SelectionMask => {
  const next = new Set<string>();
  if (axis.orientation === 'vertical') {
    const a = axis.x;
    for (const k of mask) {
      const { x, y } = parseCellKey(k);
      next.add(cellKey(2 * a - x - 1, y));
    }
  } else {
    const b = axis.y;
    for (const k of mask) {
      const { x, y } = parseCellKey(k);
      next.add(cellKey(x, 2 * b - y - 1));
    }
  }
  return next;
};
