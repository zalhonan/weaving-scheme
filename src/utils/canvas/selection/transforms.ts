import type { Line, MirrorAxis } from '../../../types';

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
