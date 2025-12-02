export type LineOrientation = 'horizontal' | 'vertical';

/**
 * Line on the grid border.
 *
 * Coordinate system:
 * - Grid has cells [0..width-1] x [0..height-1]
 * - Horizontal lines are at row boundaries (y = 0 to height)
 * - Vertical lines are at column boundaries (x = 0 to width)
 *
 * For HORIZONTAL line at row boundary `y`:
 *   - `x` = column index (0 to width-1), identifies which cell's top/bottom border
 *   - `y` = row boundary (0 = top of row 0, height = bottom of last row)
 *
 * For VERTICAL line at column boundary `x`:
 *   - `x` = column boundary (0 = left of col 0, width = right of last col)
 *   - `y` = row index (0 to height-1), identifies which cell's left/right border
 */
export interface Line {
  x: number;
  y: number;
  orientation: LineOrientation;
  color: string;
}

export const getLineKey = (
  x: number,
  y: number,
  orientation: LineOrientation
): string => `${orientation}-${x}-${y}`;

export const parseLineKey = (
  key: string
): { x: number; y: number; orientation: LineOrientation } => {
  const [orientation, x, y] = key.split('-');
  return {
    orientation: orientation as LineOrientation,
    x: Number(x),
    y: Number(y),
  };
};
