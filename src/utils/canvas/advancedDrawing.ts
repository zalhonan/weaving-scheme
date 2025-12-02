import { LineOrientation, Line } from '../../types';

/**
 * Find the nearest existing line in a direction and extend to it.
 * Returns array of lines to add, or empty array if no target found.
 */
export function extendLineToNearest(
  startX: number,
  startY: number,
  orientation: LineOrientation,
  lines: Map<string, Line>,
  canvasWidth: number,
  canvasHeight: number
): Array<{ x: number; y: number; orientation: LineOrientation }> {
  const result: Array<{ x: number; y: number; orientation: LineOrientation }> = [];

  if (orientation === 'horizontal') {
    // Extend horizontal line: find nearest existing horizontal line in the same row
    // Search left
    let leftTarget = -1;
    for (let x = startX - 1; x >= 0; x--) {
      const key = `horizontal-${x}-${startY}`;
      if (lines.has(key)) {
        leftTarget = x;
        break;
      }
    }

    // Search right
    let rightTarget = -1;
    for (let x = startX + 1; x < canvasWidth; x++) {
      const key = `horizontal-${x}-${startY}`;
      if (lines.has(key)) {
        rightTarget = x;
        break;
      }
    }

    // Choose closest target
    const leftDist = leftTarget >= 0 ? startX - leftTarget : Infinity;
    const rightDist = rightTarget >= 0 ? rightTarget - startX : Infinity;

    if (leftDist === Infinity && rightDist === Infinity) {
      return []; // No target found
    }

    if (leftDist <= rightDist && leftTarget >= 0) {
      // Extend left
      for (let x = leftTarget + 1; x <= startX; x++) {
        result.push({ x, y: startY, orientation: 'horizontal' });
      }
    } else if (rightTarget >= 0) {
      // Extend right
      for (let x = startX; x < rightTarget; x++) {
        result.push({ x, y: startY, orientation: 'horizontal' });
      }
    }
  } else {
    // Extend vertical line: find nearest existing vertical line in the same column
    // Search up
    let upTarget = -1;
    for (let y = startY - 1; y >= 0; y--) {
      const key = `vertical-${startX}-${y}`;
      if (lines.has(key)) {
        upTarget = y;
        break;
      }
    }

    // Search down
    let downTarget = -1;
    for (let y = startY + 1; y < canvasHeight; y++) {
      const key = `vertical-${startX}-${y}`;
      if (lines.has(key)) {
        downTarget = y;
        break;
      }
    }

    // Choose closest target
    const upDist = upTarget >= 0 ? startY - upTarget : Infinity;
    const downDist = downTarget >= 0 ? downTarget - startY : Infinity;

    if (upDist === Infinity && downDist === Infinity) {
      return []; // No target found
    }

    if (upDist <= downDist && upTarget >= 0) {
      // Extend up
      for (let y = upTarget + 1; y <= startY; y++) {
        result.push({ x: startX, y, orientation: 'vertical' });
      }
    } else if (downTarget >= 0) {
      // Extend down
      for (let y = startY; y < downTarget; y++) {
        result.push({ x: startX, y, orientation: 'vertical' });
      }
    }
  }

  return result;
}

/**
 * Get all lines for a full row (horizontal lines across all cells at a specific y)
 */
export function getFullRowLines(
  y: number,
  canvasWidth: number
): Array<{ x: number; y: number; orientation: LineOrientation }> {
  const result: Array<{ x: number; y: number; orientation: LineOrientation }> = [];
  for (let x = 0; x < canvasWidth; x++) {
    result.push({ x, y, orientation: 'horizontal' });
  }
  return result;
}

/**
 * Get all lines for a full column (vertical lines across all cells at a specific x)
 */
export function getFullColumnLines(
  x: number,
  canvasHeight: number
): Array<{ x: number; y: number; orientation: LineOrientation }> {
  const result: Array<{ x: number; y: number; orientation: LineOrientation }> = [];
  for (let y = 0; y < canvasHeight; y++) {
    result.push({ x, y, orientation: 'vertical' });
  }
  return result;
}
