import { CANVAS_CONSTANTS } from '../../constants';
import { screenToGrid } from './coordinates';

export type HitType =
  | 'horizontal-line'
  | 'vertical-line'
  | 'row-number'
  | 'col-number'
  | 'row-tail'
  | 'col-tail'
  | 'none';

export interface HitTestResult {
  type: HitType;
  x: number;
  y: number;
}

/**
 * Determine what the user clicked on.
 * Returns the type of hit and grid coordinates.
 */
export function hitTest(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
  cellSize: number,
  canvasWidth: number,
  canvasHeight: number
): HitTestResult {
  const { gridX, gridY } = screenToGrid(
    screenX,
    screenY,
    offsetX,
    offsetY,
    cellSize
  );

  const numberAreaStart = CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
  const gridAreaStartX = offsetX + numberAreaStart;
  const gridAreaStartY = offsetY + numberAreaStart;

  // Check if in left number/tail area (x < grid start)
  if (screenX < gridAreaStartX && screenX >= offsetX) {
    const rowIndex = Math.floor(gridY);
    if (rowIndex >= 0 && rowIndex < canvasHeight) {
      // Check if near a horizontal grid line (tail)
      const distToLine = Math.abs(gridY - Math.round(gridY));
      if (distToLine < CANVAS_CONSTANTS.HIT_TOLERANCE) {
        const lineY = Math.round(gridY);
        if (lineY >= 0 && lineY <= canvasHeight) {
          return { type: 'row-tail', x: 0, y: lineY };
        }
      }
      return { type: 'row-number', x: 0, y: rowIndex };
    }
  }

  // Check if in top number/tail area (y < grid start)
  if (screenY < gridAreaStartY && screenY >= offsetY) {
    const colIndex = Math.floor(gridX);
    if (colIndex >= 0 && colIndex < canvasWidth) {
      // Check if near a vertical grid line (tail)
      const distToLine = Math.abs(gridX - Math.round(gridX));
      if (distToLine < CANVAS_CONSTANTS.HIT_TOLERANCE) {
        const lineX = Math.round(gridX);
        if (lineX >= 0 && lineX <= canvasWidth) {
          return { type: 'col-tail', x: lineX, y: 0 };
        }
      }
      return { type: 'col-number', x: colIndex, y: 0 };
    }
  }

  // Main grid area
  if (
    gridX < 0 ||
    gridX > canvasWidth ||
    gridY < 0 ||
    gridY > canvasHeight
  ) {
    return { type: 'none', x: 0, y: 0 };
  }

  // Check proximity to grid lines
  const distToHorizontal = Math.abs(gridY - Math.round(gridY));
  const distToVertical = Math.abs(gridX - Math.round(gridX));

  const tolerance = CANVAS_CONSTANTS.HIT_TOLERANCE;

  if (distToHorizontal < tolerance && distToVertical < tolerance) {
    // Near intersection - pick closer one
    if (distToHorizontal < distToVertical) {
      const lineY = Math.round(gridY);
      const cellX = Math.floor(gridX);
      if (
        lineY >= 0 &&
        lineY <= canvasHeight &&
        cellX >= 0 &&
        cellX < canvasWidth
      ) {
        return { type: 'horizontal-line', x: cellX, y: lineY };
      }
    } else {
      const lineX = Math.round(gridX);
      const cellY = Math.floor(gridY);
      if (
        lineX >= 0 &&
        lineX <= canvasWidth &&
        cellY >= 0 &&
        cellY < canvasHeight
      ) {
        return { type: 'vertical-line', x: lineX, y: cellY };
      }
    }
  }

  if (distToHorizontal < tolerance) {
    const lineY = Math.round(gridY);
    const cellX = Math.floor(gridX);
    if (
      lineY >= 0 &&
      lineY <= canvasHeight &&
      cellX >= 0 &&
      cellX < canvasWidth
    ) {
      return { type: 'horizontal-line', x: cellX, y: lineY };
    }
  }

  if (distToVertical < tolerance) {
    const lineX = Math.round(gridX);
    const cellY = Math.floor(gridY);
    if (
      lineX >= 0 &&
      lineX <= canvasWidth &&
      cellY >= 0 &&
      cellY < canvasHeight
    ) {
      return { type: 'vertical-line', x: lineX, y: cellY };
    }
  }

  return { type: 'none', x: 0, y: 0 };
}
