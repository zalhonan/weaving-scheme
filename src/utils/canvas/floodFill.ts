import { Line, LineOrientation, getLineKey } from '../../types';

interface FloodFillResult {
  success: boolean;
  lines: Array<{ x: number; y: number; orientation: LineOrientation }>;
  error?: string;
}

/**
 * Flood fill algorithm to fill all borders inside a closed contour.
 *
 * The algorithm:
 * 1. Start from the clicked cell
 * 2. Use BFS to find all connected cells (cells not separated by lines)
 * 3. If any cell reaches the canvas boundary, the contour is not closed
 * 4. If contour is closed, return all borders of the visited cells
 */
export function floodFill(
  startCellX: number,
  startCellY: number,
  lines: Map<string, Line>,
  canvasWidth: number,
  canvasHeight: number
): FloodFillResult {
  // Check if start cell is valid
  if (
    startCellX < 0 ||
    startCellX >= canvasWidth ||
    startCellY < 0 ||
    startCellY >= canvasHeight
  ) {
    return { success: false, lines: [], error: 'Точка вне канвы' };
  }

  const visited = new Set<string>();
  const queue: Array<{ x: number; y: number }> = [{ x: startCellX, y: startCellY }];
  const cellsToFill: Array<{ x: number; y: number }> = [];

  const getCellKey = (x: number, y: number) => `${x}-${y}`;

  // Helper to check if a border exists
  const hasLine = (x: number, y: number, orientation: LineOrientation): boolean => {
    const key = getLineKey(x, y, orientation);
    return lines.has(key);
  };

  // BFS to find all connected cells
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const cellKey = getCellKey(cell.x, cell.y);

    if (visited.has(cellKey)) continue;
    visited.add(cellKey);

    // Check if we reached the boundary (contour not closed)
    // A cell at the edge without a line on the outer side means contour is open
    if (cell.x === 0 && !hasLine(0, cell.y, 'vertical')) {
      return { success: false, lines: [], error: 'Заливка невозможна, контур не замкнут' };
    }
    if (cell.x === canvasWidth - 1 && !hasLine(canvasWidth, cell.y, 'vertical')) {
      return { success: false, lines: [], error: 'Заливка невозможна, контур не замкнут' };
    }
    if (cell.y === 0 && !hasLine(cell.x, 0, 'horizontal')) {
      return { success: false, lines: [], error: 'Заливка невозможна, контур не замкнут' };
    }
    if (cell.y === canvasHeight - 1 && !hasLine(cell.x, canvasHeight, 'horizontal')) {
      return { success: false, lines: [], error: 'Заливка невозможна, контур не замкнут' };
    }

    cellsToFill.push(cell);

    // Check neighbors
    // Left neighbor (cell.x - 1, cell.y) - blocked by vertical line at x
    if (cell.x > 0 && !hasLine(cell.x, cell.y, 'vertical')) {
      const neighborKey = getCellKey(cell.x - 1, cell.y);
      if (!visited.has(neighborKey)) {
        queue.push({ x: cell.x - 1, y: cell.y });
      }
    }

    // Right neighbor (cell.x + 1, cell.y) - blocked by vertical line at x + 1
    if (cell.x < canvasWidth - 1 && !hasLine(cell.x + 1, cell.y, 'vertical')) {
      const neighborKey = getCellKey(cell.x + 1, cell.y);
      if (!visited.has(neighborKey)) {
        queue.push({ x: cell.x + 1, y: cell.y });
      }
    }

    // Top neighbor (cell.x, cell.y - 1) - blocked by horizontal line at y
    if (cell.y > 0 && !hasLine(cell.x, cell.y, 'horizontal')) {
      const neighborKey = getCellKey(cell.x, cell.y - 1);
      if (!visited.has(neighborKey)) {
        queue.push({ x: cell.x, y: cell.y - 1 });
      }
    }

    // Bottom neighbor (cell.x, cell.y + 1) - blocked by horizontal line at y + 1
    if (cell.y < canvasHeight - 1 && !hasLine(cell.x, cell.y + 1, 'horizontal')) {
      const neighborKey = getCellKey(cell.x, cell.y + 1);
      if (!visited.has(neighborKey)) {
        queue.push({ x: cell.x, y: cell.y + 1 });
      }
    }
  }

  // Collect all borders of visited cells
  const resultLines: Array<{ x: number; y: number; orientation: LineOrientation }> = [];
  const addedLines = new Set<string>();

  for (const cell of cellsToFill) {
    // Top border
    const topKey = getLineKey(cell.x, cell.y, 'horizontal');
    if (!addedLines.has(topKey)) {
      resultLines.push({ x: cell.x, y: cell.y, orientation: 'horizontal' });
      addedLines.add(topKey);
    }

    // Bottom border
    const bottomKey = getLineKey(cell.x, cell.y + 1, 'horizontal');
    if (!addedLines.has(bottomKey)) {
      resultLines.push({ x: cell.x, y: cell.y + 1, orientation: 'horizontal' });
      addedLines.add(bottomKey);
    }

    // Left border
    const leftKey = getLineKey(cell.x, cell.y, 'vertical');
    if (!addedLines.has(leftKey)) {
      resultLines.push({ x: cell.x, y: cell.y, orientation: 'vertical' });
      addedLines.add(leftKey);
    }

    // Right border
    const rightKey = getLineKey(cell.x + 1, cell.y, 'vertical');
    if (!addedLines.has(rightKey)) {
      resultLines.push({ x: cell.x + 1, y: cell.y, orientation: 'vertical' });
      addedLines.add(rightKey);
    }
  }

  return { success: true, lines: resultLines };
}
