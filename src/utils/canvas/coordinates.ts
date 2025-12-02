import { CANVAS_CONSTANTS } from '../../constants';

/**
 * Convert screen coordinates to grid coordinates.
 */
export function screenToGrid(
  screenX: number,
  screenY: number,
  offsetX: number,
  offsetY: number,
  cellSize: number
): { gridX: number; gridY: number } {
  const gridX =
    (screenX - offsetX - CANVAS_CONSTANTS.NUMBER_AREA_WIDTH) / cellSize;
  const gridY =
    (screenY - offsetY - CANVAS_CONSTANTS.NUMBER_AREA_WIDTH) / cellSize;
  return { gridX, gridY };
}

/**
 * Convert grid coordinates to screen coordinates.
 */
export function gridToScreen(
  gridX: number,
  gridY: number,
  offsetX: number,
  offsetY: number,
  cellSize: number
): { screenX: number; screenY: number } {
  const screenX =
    gridX * cellSize + offsetX + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
  const screenY =
    gridY * cellSize + offsetY + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
  return { screenX, screenY };
}

/**
 * Get the screen position for the start of the grid area.
 */
export function getGridAreaStart(
  offsetX: number,
  offsetY: number
): { x: number; y: number } {
  return {
    x: offsetX + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH,
    y: offsetY + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH,
  };
}
