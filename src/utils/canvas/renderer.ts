import { Line } from '../../types';
import { CANVAS_CONSTANTS } from '../../constants';

export interface RenderOptions {
  canvasWidth: number;
  canvasHeight: number;
  lines: Map<string, Line>;
  offsetX: number;
  offsetY: number;
  cellSize: number;
  getCellColor?: (cellX: number, cellY: number) => string | null;
}

/**
 * Render the grid canvas.
 */
export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  options: RenderOptions
): void {
  const {
    canvasWidth,
    canvasHeight,
    lines,
    offsetX,
    offsetY,
    cellSize,
    getCellColor,
  } = options;

  const dpr = window.devicePixelRatio || 1;
  const canvas = ctx.canvas;

  // Setup canvas size with DPR
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  // Clear canvas
  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const numberArea = CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
  const gridStartX = offsetX + numberArea;
  const gridStartY = offsetY + numberArea;

  // Draw cell highlights (layer 1)
  if (getCellColor) {
    for (let cellX = 0; cellX < canvasWidth; cellX++) {
      for (let cellY = 0; cellY < canvasHeight; cellY++) {
        const color = getCellColor(cellX, cellY);
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(
            gridStartX + cellX * cellSize,
            gridStartY + cellY * cellSize,
            cellSize,
            cellSize
          );
        }
      }
    }
  }

  // Draw grid lines (layer 2)
  ctx.strokeStyle = CANVAS_CONSTANTS.GRID_COLOR;
  ctx.lineWidth = CANVAS_CONSTANTS.GRID_LINE_WIDTH;

  // Vertical grid lines
  for (let i = 0; i <= canvasWidth; i++) {
    const x = gridStartX + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, gridStartY);
    ctx.lineTo(x, gridStartY + canvasHeight * cellSize);
    ctx.stroke();
  }

  // Horizontal grid lines
  for (let i = 0; i <= canvasHeight; i++) {
    const y = gridStartY + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(gridStartX, y);
    ctx.lineTo(gridStartX + canvasWidth * cellSize, y);
    ctx.stroke();
  }

  // Draw tails (clickable line extensions)
  const tailLength = cellSize * 0.5;

  // Horizontal tails (left side, for row operations)
  for (let i = 0; i <= canvasHeight; i++) {
    const y = gridStartY + i * cellSize;
    const tailStartX = gridStartX - tailLength;
    ctx.beginPath();
    ctx.moveTo(tailStartX, y);
    ctx.lineTo(gridStartX, y);
    ctx.stroke();
  }

  // Vertical tails (top side, for column operations)
  for (let i = 0; i <= canvasWidth; i++) {
    const x = gridStartX + i * cellSize;
    const tailStartY = gridStartY - tailLength;
    ctx.beginPath();
    ctx.moveTo(x, tailStartY);
    ctx.lineTo(x, gridStartY);
    ctx.stroke();
  }

  // Draw major grid lines (every 10 cells)
  ctx.strokeStyle = CANVAS_CONSTANTS.MAJOR_GRID_COLOR;
  ctx.lineWidth = CANVAS_CONSTANTS.MAJOR_GRID_LINE_WIDTH;

  const interval = CANVAS_CONSTANTS.MAJOR_GRID_INTERVAL;

  // Vertical major lines
  for (let i = 0; i <= canvasWidth; i += interval) {
    const x = gridStartX + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, gridStartY);
    ctx.lineTo(x, gridStartY + canvasHeight * cellSize);
    ctx.stroke();
  }

  // Horizontal major lines
  for (let i = 0; i <= canvasHeight; i += interval) {
    const y = gridStartY + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(gridStartX, y);
    ctx.lineTo(gridStartX + canvasWidth * cellSize, y);
    ctx.stroke();
  }

  // Draw numbers (layer 3)
  ctx.fillStyle = '#666666';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Column numbers (top)
  for (let i = 0; i < canvasWidth; i++) {
    const x = gridStartX + i * cellSize + cellSize / 2;
    const y = offsetY + numberArea / 2;
    ctx.fillText(String(i), x, y);
  }

  // Row numbers (left)
  for (let i = 0; i < canvasHeight; i++) {
    const x = offsetX + numberArea / 2;
    const y = gridStartY + i * cellSize + cellSize / 2;
    ctx.fillText(String(i), x, y);
  }

  // Draw user lines (layer 4)
  ctx.lineWidth = CANVAS_CONSTANTS.USER_LINE_WIDTH;
  ctx.lineCap = 'round';

  lines.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.beginPath();

    if (line.orientation === 'horizontal') {
      // Horizontal line at row boundary y, spanning cell x
      const x1 = gridStartX + line.x * cellSize;
      const x2 = gridStartX + (line.x + 1) * cellSize;
      const y = gridStartY + line.y * cellSize;
      ctx.moveTo(x1, y);
      ctx.lineTo(x2, y);
    } else {
      // Vertical line at column boundary x, spanning cell y
      const x = gridStartX + line.x * cellSize;
      const y1 = gridStartY + line.y * cellSize;
      const y2 = gridStartY + (line.y + 1) * cellSize;
      ctx.moveTo(x, y1);
      ctx.lineTo(x, y2);
    }

    ctx.stroke();
  });
}
