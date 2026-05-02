import { CANVAS_CONSTANTS } from '../../constants';
import type { Segment } from './selection/marchingAnts';
import type { MarqueePreview } from '../../store/useSelectionStore';

export interface OverlayRenderOptions {
  offsetX: number;
  offsetY: number;
  cellSize: number;
  /** Boundary segments of the committed selection (in grid coords). */
  selectionSegments: Segment[];
  /** Live drag preview, if any. */
  marqueePreview: MarqueePreview | null;
  /** Marching-ants animation phase, advanced ~0.5 px / frame. */
  dashOffset: number;
}

const DASH_LENGTH = 4;
const DASH_PATTERN: [number, number] = [DASH_LENGTH, DASH_LENGTH];

/**
 * Map a grid coordinate to a screen coordinate, mirroring `gridToScreen`
 * from `coordinates.ts` (kept inline so the overlay renderer remains a
 * pure function with no util-side-effects beyond constants).
 */
const gridToScreen = (
  gx: number,
  gy: number,
  offsetX: number,
  offsetY: number,
  cellSize: number,
): { x: number; y: number } => ({
  x: gx * cellSize + offsetX + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH,
  y: gy * cellSize + offsetY + CANVAS_CONSTANTS.NUMBER_AREA_WIDTH,
});

const drawAnts = (
  ctx: CanvasRenderingContext2D,
  segments: Segment[],
  offsetX: number,
  offsetY: number,
  cellSize: number,
  dashOffset: number,
): void => {
  if (segments.length === 0) return;

  ctx.lineWidth = 1.5;
  ctx.setLineDash(DASH_PATTERN);

  // White underlay
  ctx.strokeStyle = '#ffffff';
  ctx.lineDashOffset = -dashOffset;
  ctx.beginPath();
  for (const s of segments) {
    const a = gridToScreen(s.x1, s.y1, offsetX, offsetY, cellSize);
    const b = gridToScreen(s.x2, s.y2, offsetX, offsetY, cellSize);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  // Black overlay, half-cycle offset → alternating "ants"
  ctx.strokeStyle = '#000000';
  ctx.lineDashOffset = -dashOffset + DASH_LENGTH;
  ctx.beginPath();
  for (const s of segments) {
    const a = gridToScreen(s.x1, s.y1, offsetX, offsetY, cellSize);
    const b = gridToScreen(s.x2, s.y2, offsetX, offsetY, cellSize);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();

  ctx.setLineDash([]);
};

const drawMarquee = (
  ctx: CanvasRenderingContext2D,
  preview: MarqueePreview,
  offsetX: number,
  offsetY: number,
  cellSize: number,
  dashOffset: number,
): void => {
  ctx.lineWidth = 1.5;
  ctx.setLineDash(DASH_PATTERN);
  ctx.strokeStyle = '#000000';
  ctx.lineDashOffset = -dashOffset;

  if (preview.kind === 'rect' && preview.rect) {
    const { x0, y0, x1, y1 } = preview.rect;
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1) + 1;
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1) + 1;
    const a = gridToScreen(minX, minY, offsetX, offsetY, cellSize);
    const b = gridToScreen(maxX, maxY, offsetX, offsetY, cellSize);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
  } else if (preview.kind === 'lasso' && preview.lasso && preview.lasso.length > 1) {
    ctx.beginPath();
    const first = gridToScreen(
      preview.lasso[0].x,
      preview.lasso[0].y,
      offsetX,
      offsetY,
      cellSize,
    );
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < preview.lasso.length; i++) {
      const p = gridToScreen(
        preview.lasso[i].x,
        preview.lasso[i].y,
        offsetX,
        offsetY,
        cellSize,
      );
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  ctx.setLineDash([]);
};

/**
 * Render the overlay layer (selection ants + live marquee). Idempotent —
 * clears before drawing.
 */
export function renderOverlay(
  ctx: CanvasRenderingContext2D,
  options: OverlayRenderOptions,
): void {
  const { offsetX, offsetY, cellSize, selectionSegments, marqueePreview, dashOffset } = options;

  const dpr = window.devicePixelRatio || 1;
  const canvas = ctx.canvas;
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
  }

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  drawAnts(ctx, selectionSegments, offsetX, offsetY, cellSize, dashOffset);
  if (marqueePreview) {
    drawMarquee(ctx, marqueePreview, offsetX, offsetY, cellSize, dashOffset);
  }
}
