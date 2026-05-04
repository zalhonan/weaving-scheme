import { Line } from '../../types';
import { CANVAS_CONSTANTS } from '../../constants';

// Adaptive-rendering thresholds. Each layer disappears (or degrades into a
// cheaper fallback) when cellSize drops below its threshold. All thresholds
// sit *below* 8 px so behavior at default zoom and above is byte-identical
// to the pre-adaptive renderer.
const NUMBERS_MIN_CELL_SIZE = 8;
const TAILS_MIN_CELL_SIZE = 4;
const MINOR_GRID_MIN_CELL_SIZE = 2.5;
const MAJOR_GRID_MIN_CELL_SIZE = 1.5;
const USER_LINE_STROKE_MIN_CELL_SIZE = 1.5;

interface RenderProfile {
  showNumbers: boolean;
  showTails: boolean;
  showMinorGrid: boolean;
  showMajorGrid: boolean;
  userLineMode: 'stroke' | 'fillRect';
}

function profileFor(cellSize: number): RenderProfile {
  return {
    showNumbers: cellSize >= NUMBERS_MIN_CELL_SIZE,
    showTails: cellSize >= TAILS_MIN_CELL_SIZE,
    showMinorGrid: cellSize >= MINOR_GRID_MIN_CELL_SIZE,
    showMajorGrid: cellSize >= MAJOR_GRID_MIN_CELL_SIZE,
    userLineMode:
      cellSize >= USER_LINE_STROKE_MIN_CELL_SIZE ? 'stroke' : 'fillRect',
  };
}

export interface RenderOptions {
  canvasWidth: number;
  canvasHeight: number;
  lines: Map<string, Line>;
  offsetX: number;
  offsetY: number;
  cellSize: number;
  getCellColor?: (cellX: number, cellY: number) => string | null;
  /**
   * Line keys to skip during the user-line drawing pass. Used to "lift"
   * source lines off the canvas while a move/mirror floating layer is
   * active — the canvas store is unchanged; only the render skips them.
   */
  hiddenLineKeys?: Set<string> | null;
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
    hiddenLineKeys,
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

  const profile = profileFor(cellSize);

  // Visible cell range with ±1 padding to absorb fractional-offset edges.
  // Padding the *outside* of the bounded loops is cheaper than risking a
  // 1-pixel band of un-rendered content when offsets are non-integer.
  const visibleMinCellX = Math.max(
    0,
    Math.floor(-gridStartX / cellSize) - 1
  );
  const visibleMaxCellX = Math.min(
    canvasWidth - 1,
    Math.floor((displayWidth - gridStartX) / cellSize) + 1
  );
  const visibleMinCellY = Math.max(
    0,
    Math.floor(-gridStartY / cellSize) - 1
  );
  const visibleMaxCellY = Math.min(
    canvasHeight - 1,
    Math.floor((displayHeight - gridStartY) / cellSize) + 1
  );

  // Boundary-line index range = cell range extended by one on the high side.
  const visibleMinBoundaryX = visibleMinCellX;
  const visibleMaxBoundaryX = Math.min(canvasWidth, visibleMaxCellX + 1);
  const visibleMinBoundaryY = visibleMinCellY;
  const visibleMaxBoundaryY = Math.min(canvasHeight, visibleMaxCellY + 1);

  // Layer 1: cell highlights. Loop is bounded — at 1000×1000 zoomed out we
  // would otherwise iterate 1M cells per frame regardless of viewport.
  if (getCellColor) {
    for (let cellX = visibleMinCellX; cellX <= visibleMaxCellX; cellX++) {
      for (let cellY = visibleMinCellY; cellY <= visibleMaxCellY; cellY++) {
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

  // Layer 2: minor grid lines. Hidden when cellSize < MINOR_GRID_MIN.
  if (profile.showMinorGrid) {
    ctx.strokeStyle = CANVAS_CONSTANTS.GRID_COLOR;
    ctx.lineWidth = CANVAS_CONSTANTS.GRID_LINE_WIDTH;

    // Vertical grid lines
    for (let i = visibleMinBoundaryX; i <= visibleMaxBoundaryX; i++) {
      const x = gridStartX + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, gridStartY);
      ctx.lineTo(x, gridStartY + canvasHeight * cellSize);
      ctx.stroke();
    }

    // Horizontal grid lines
    for (let i = visibleMinBoundaryY; i <= visibleMaxBoundaryY; i++) {
      const y = gridStartY + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(gridStartX, y);
      ctx.lineTo(gridStartX + canvasWidth * cellSize, y);
      ctx.stroke();
    }
  }

  // Layer 3: tails (clickable line extensions). Hidden when subpixel.
  if (profile.showTails) {
    ctx.strokeStyle = CANVAS_CONSTANTS.GRID_COLOR;
    ctx.lineWidth = CANVAS_CONSTANTS.GRID_LINE_WIDTH;

    const tailLength = cellSize * 0.5;

    // Horizontal tails (left side, for row operations)
    for (let i = visibleMinBoundaryY; i <= visibleMaxBoundaryY; i++) {
      const y = gridStartY + i * cellSize;
      const tailStartX = gridStartX - tailLength;
      ctx.beginPath();
      ctx.moveTo(tailStartX, y);
      ctx.lineTo(gridStartX, y);
      ctx.stroke();
    }

    // Vertical tails (top side, for column operations)
    for (let i = visibleMinBoundaryX; i <= visibleMaxBoundaryX; i++) {
      const x = gridStartX + i * cellSize;
      const tailStartY = gridStartY - tailLength;
      ctx.beginPath();
      ctx.moveTo(x, tailStartY);
      ctx.lineTo(x, gridStartY);
      ctx.stroke();
    }
  }

  // Layer 4: major grid lines (every 10 cells). Hidden when sub-stroke-width.
  if (profile.showMajorGrid) {
    ctx.strokeStyle = CANVAS_CONSTANTS.MAJOR_GRID_COLOR;
    ctx.lineWidth = CANVAS_CONSTANTS.MAJOR_GRID_LINE_WIDTH;

    const interval = CANVAS_CONSTANTS.MAJOR_GRID_INTERVAL;
    // Round start *down* to the previous multiple of interval so we don't
    // clip a major line at the visible edge.
    const majorStartX =
      Math.floor(visibleMinBoundaryX / interval) * interval;
    const majorStartY =
      Math.floor(visibleMinBoundaryY / interval) * interval;

    // Vertical major lines
    for (let i = majorStartX; i <= visibleMaxBoundaryX; i += interval) {
      const x = gridStartX + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(x, gridStartY);
      ctx.lineTo(x, gridStartY + canvasHeight * cellSize);
      ctx.stroke();
    }

    // Horizontal major lines
    for (let i = majorStartY; i <= visibleMaxBoundaryY; i += interval) {
      const y = gridStartY + i * cellSize;
      ctx.beginPath();
      ctx.moveTo(gridStartX, y);
      ctx.lineTo(gridStartX + canvasWidth * cellSize, y);
      ctx.stroke();
    }
  }

  // Layer 5: row and column numbers. Hidden when font would overlap.
  if (profile.showNumbers) {
    ctx.fillStyle = '#666666';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Column numbers (top)
    for (let i = visibleMinCellX; i <= visibleMaxCellX; i++) {
      const x = gridStartX + i * cellSize + cellSize / 2;
      const y = offsetY + numberArea / 2;
      ctx.fillText(String(i), x, y);
    }

    // Row numbers (left)
    for (let i = visibleMinCellY; i <= visibleMaxCellY; i++) {
      const x = offsetX + numberArea / 2;
      const y = gridStartY + i * cellSize + cellSize / 2;
      ctx.fillText(String(i), x, y);
    }
  }

  // Layer 6: user lines. Stroke at normal zoom; fillRect fallback at extreme
  // zoom-out where a 2 px stroke would smear across multiple cells.
  if (profile.userLineMode === 'stroke') {
    ctx.lineWidth = CANVAS_CONSTANTS.USER_LINE_WIDTH;
    ctx.lineCap = 'round';

    lines.forEach((line, key) => {
      if (hiddenLineKeys && hiddenLineKeys.has(key)) return;
      // Visible-bbox filter (±1 cell padding for boundary-touching lines).
      if (line.x < visibleMinCellX - 1 || line.x > visibleMaxCellX + 1) return;
      if (line.y < visibleMinCellY - 1 || line.y > visibleMaxCellY + 1) return;

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
  } else {
    // fillRect fallback. A square of size max(1, cellSize) centered on the
    // cell edge — produces a coherent dot pattern at sub-pixel cell sizes
    // instead of the stroke smearing across neighbors.
    const side = Math.max(1, cellSize);
    const half = side / 2;

    lines.forEach((line, key) => {
      if (hiddenLineKeys && hiddenLineKeys.has(key)) return;
      if (line.x < visibleMinCellX - 1 || line.x > visibleMaxCellX + 1) return;
      if (line.y < visibleMinCellY - 1 || line.y > visibleMaxCellY + 1) return;

      ctx.fillStyle = line.color;

      if (line.orientation === 'horizontal') {
        const cx = gridStartX + (line.x + 0.5) * cellSize;
        const cy = gridStartY + line.y * cellSize;
        ctx.fillRect(cx - half, cy - half, side, side);
      } else {
        const cx = gridStartX + line.x * cellSize;
        const cy = gridStartY + (line.y + 0.5) * cellSize;
        ctx.fillRect(cx - half, cy - half, side, side);
      }
    });
  }
}
