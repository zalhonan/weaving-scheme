import type { Line, MirrorAxis, RotationDirection } from '../../../types';

/**
 * Translate lines by (dx, dy) in cell units. Pure — does not check bounds.
 */
export const translateLines = (lines: Line[], dx: number, dy: number): Line[] =>
  lines.map((line) => ({ ...line, x: line.x + dx, y: line.y + dy }));

/**
 * Mirror lines across an axis. Orientation is preserved (this is a flip,
 * not a rotation).
 *
 * Vertical axis x = a (column boundary):
 *   - Horizontal line (x, y) spans [x, x+1] along boundary y → new x = 2a − x − 1
 *   - Vertical line (x, y) at column boundary x → new x = 2a − x
 *
 * Horizontal axis y = b (row boundary):
 *   - Horizontal line (x, y) on row boundary y → new y = 2b − y
 *   - Vertical line (x, y) spans [y, y+1] → new y = 2b − y − 1
 */
export const mirrorLines = (lines: Line[], axis: MirrorAxis): Line[] => {
  if (axis.orientation === 'vertical') {
    const a = axis.x;
    return lines.map((line) =>
      line.orientation === 'horizontal'
        ? { ...line, x: 2 * a - line.x - 1 }
        : { ...line, x: 2 * a - line.x },
    );
  }
  const b = axis.y;
  return lines.map((line) =>
    line.orientation === 'horizontal'
      ? { ...line, y: 2 * b - line.y }
      : { ...line, y: 2 * b - line.y - 1 },
  );
};

/**
 * Translate lines so that the minimum x and y across all lines become 0.
 * Used by copy/cut to normalize clipboard content to a (0, 0) origin.
 */
export const normalizeToOrigin = (lines: Line[]): Line[] => {
  if (lines.length === 0) return [];
  let minX = Infinity;
  let minY = Infinity;
  for (const line of lines) {
    if (line.x < minX) minX = line.x;
    if (line.y < minY) minY = line.y;
  }
  return translateLines(lines, -minX, -minY);
};

/**
 * Rotate lines 90° (clockwise or counter-clockwise) around pivot `(cx, cy)`.
 * Lines flip orientation: horizontal → vertical and vice versa.
 *
 * Screen coords (y-down). For non-square pivots (half-integer cx or cy),
 * results are rounded to the nearest integer cell/line index — see design.md
 * "Half-integer pivot rounding" for the rationale.
 *
 * Screen 90° CW transformations:
 *   - Horizontal (x, y) → Vertical (cx + cy − y, x + cy − cx)
 *   - Vertical   (x, y) → Horizontal (cx + cy − y − 1, x + cy − cx)
 *
 * Screen 90° CCW transformations:
 *   - Horizontal (x, y) → Vertical (cx + y − cy, cy + cx − x − 1)
 *   - Vertical   (x, y) → Horizontal (cx + y − cy, cy + cx − x)
 */
export const rotateLines = (
  lines: Line[],
  direction: RotationDirection,
  cx: number,
  cy: number,
): Line[] =>
  lines.map((line) => {
    let nx: number;
    let ny: number;
    if (direction === 'cw') {
      if (line.orientation === 'horizontal') {
        nx = cx + cy - line.y;
        ny = line.x + cy - cx;
        return {
          ...line,
          x: Math.round(nx),
          y: Math.round(ny),
          orientation: 'vertical',
        };
      }
      nx = cx + cy - line.y - 1;
      ny = line.x + cy - cx;
      return {
        ...line,
        x: Math.round(nx),
        y: Math.round(ny),
        orientation: 'horizontal',
      };
    }
    // ccw
    if (line.orientation === 'horizontal') {
      nx = cx + line.y - cy;
      ny = cy + cx - line.x - 1;
      return {
        ...line,
        x: Math.round(nx),
        y: Math.round(ny),
        orientation: 'vertical',
      };
    }
    nx = cx + line.y - cy;
    ny = cy + cx - line.x;
    return {
      ...line,
      x: Math.round(nx),
      y: Math.round(ny),
      orientation: 'horizontal',
    };
  });

/**
 * Drop lines that lie outside the canvas. Used at commit time when a ghost
 * has been dragged partly off the edge: the visible portion lands; the
 * off-canvas remainder is discarded.
 *
 * In-bounds rules (mirror `Line` semantics):
 *   - Horizontal at (x, y): x ∈ [0, width-1], y ∈ [0, height]
 *   - Vertical   at (x, y): x ∈ [0, width],   y ∈ [0, height-1]
 */
export const clipLinesToCanvas = (
  lines: Line[],
  width: number,
  height: number,
): Line[] =>
  lines.filter((line) =>
    line.orientation === 'horizontal'
      ? line.x >= 0 && line.x < width && line.y >= 0 && line.y <= height
      : line.x >= 0 && line.x <= width && line.y >= 0 && line.y < height,
  );

/**
 * Bbox of a line set in line-coordinate space (NOT cell space).
 * Returns null for empty input.
 */
export const linesBbox = (
  lines: Line[],
): { minX: number; minY: number; maxX: number; maxY: number } | null => {
  if (lines.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const line of lines) {
    if (line.x < minX) minX = line.x;
    if (line.x > maxX) maxX = line.x;
    if (line.y < minY) minY = line.y;
    if (line.y > maxY) maxY = line.y;
  }
  return { minX, minY, maxX, maxY };
};
