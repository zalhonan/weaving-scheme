import { describe, it, expect } from 'vitest';
import { renderCanvas } from '../../../src/utils/canvas/renderer';
import type { Line } from '../../../src/types';
import { getLineKey } from '../../../src/types';

interface RecordedCall {
  method: string;
  args: unknown[];
}

interface StubCanvas {
  width: number;
  height: number;
  clientWidth: number;
  clientHeight: number;
}

interface StubCtx {
  canvas: StubCanvas;
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  lineCap: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  scale: (...a: unknown[]) => void;
  clearRect: (...a: unknown[]) => void;
  fillRect: (...a: unknown[]) => void;
  fillText: (...a: unknown[]) => void;
  beginPath: (...a: unknown[]) => void;
  moveTo: (...a: unknown[]) => void;
  lineTo: (...a: unknown[]) => void;
  stroke: (...a: unknown[]) => void;
}

function makeCtx(displayW: number, displayH: number) {
  const calls: RecordedCall[] = [];
  const canvas: StubCanvas = {
    // Pre-size canvas.width/height to match display × dpr=1 so the renderer
    // does not enter its DPR-resize branch (one less call to record).
    width: displayW,
    height: displayH,
    clientWidth: displayW,
    clientHeight: displayH,
  };
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
    };
  const ctx: StubCtx = {
    canvas,
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    scale: record('scale'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    fillText: record('fillText'),
    beginPath: record('beginPath'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    stroke: record('stroke'),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

const seedLines = (
  entries: Array<Omit<Line, 'color'> & { color?: string }>
): Map<string, Line> => {
  const m = new Map<string, Line>();
  for (const e of entries) {
    const line: Line = { ...e, color: e.color ?? '#000000' };
    m.set(getLineKey(e.x, e.y, e.orientation), line);
  }
  return m;
};

const countCalls = (calls: RecordedCall[], method: string) =>
  calls.filter((c) => c.method === method).length;

describe('renderer — regression at cellSize ≥ 8 (all layers active)', () => {
  it.each([8, 12, 25, 50])(
    'cellSize=%d draws all layers (numbers, minor grid, major grid, tails, user lines)',
    (cellSize) => {
      const { ctx, calls } = makeCtx(800, 600);
      const lines = seedLines([
        { x: 1, y: 2, orientation: 'horizontal' },
        { x: 3, y: 4, orientation: 'vertical' },
      ]);
      renderCanvas(ctx, {
        canvasWidth: 20,
        canvasHeight: 20,
        lines,
        offsetX: 0,
        offsetY: 0,
        cellSize,
      });

      // All 4 layers fire at cellSize ≥ 8.
      expect(countCalls(calls, 'fillText')).toBeGreaterThan(0); // numbers
      expect(countCalls(calls, 'stroke')).toBeGreaterThan(0); // grid + tails + user
      // User lines: stroke mode (no fillRect except for highlights, which we have none of here)
      expect(countCalls(calls, 'fillRect')).toBe(0);
      // No fillRect path means user lines went through stroke — regression contract.
    }
  );

  it('cell highlights still render as fillRect at cellSize ≥ 8', () => {
    const { ctx, calls } = makeCtx(800, 600);
    renderCanvas(ctx, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 25,
      getCellColor: (x, y) => (x === 5 && y === 5 ? '#FFE0E0' : null),
    });
    expect(countCalls(calls, 'fillRect')).toBe(1); // exactly one highlighted cell
  });
});

describe('renderer — adaptive thresholds (new behavior)', () => {
  it('cellSize=7.5 hides numbers (font would overlap)', () => {
    const { ctx, calls } = makeCtx(800, 600);
    renderCanvas(ctx, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 7.5,
    });
    expect(countCalls(calls, 'fillText')).toBe(0);
  });

  it('cellSize=3.5 hides tails (subpixel strokes)', () => {
    const { ctx: ctx1, calls: callsWith } = makeCtx(800, 600);
    renderCanvas(ctx1, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 5, // tails ON
    });
    const strokesAtFive = countCalls(callsWith, 'stroke');

    const { ctx: ctx2, calls: callsWithout } = makeCtx(800, 600);
    renderCanvas(ctx2, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 3.5, // tails OFF
    });
    const strokesAtThreeFive = countCalls(callsWithout, 'stroke');

    // Removing the tails layer drops 2 × (canvasWidth + canvasHeight + 2) strokes.
    expect(strokesAtFive).toBeGreaterThan(strokesAtThreeFive);
  });

  it('cellSize=1.4 hides both minor and major grid', () => {
    const { ctx, calls } = makeCtx(400, 400);
    renderCanvas(ctx, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 1.4,
    });
    // No grid/tails/numbers — strokes should be 0 (no user lines either).
    expect(countCalls(calls, 'stroke')).toBe(0);
    expect(countCalls(calls, 'fillText')).toBe(0);
  });

  it('cellSize=1.6 keeps major grid (≥1.5) but minor is gone (<2.5)', () => {
    const { ctx, calls } = makeCtx(400, 400);
    renderCanvas(ctx, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 1.6,
    });
    // Major grid every 10 cells over a 20x20 grid: 3 vertical + 3 horizontal = 6.
    // No tails (< 4), no numbers (< 8), no user lines, no minor grid (< 2.5).
    expect(countCalls(calls, 'stroke')).toBe(6);
  });

  it('cellSize=1 renders user lines as fillRect, not stroke', () => {
    const lines = seedLines([
      { x: 1, y: 2, orientation: 'horizontal' },
      { x: 3, y: 4, orientation: 'vertical' },
      { x: 5, y: 5, orientation: 'horizontal' },
    ]);
    const { ctx, calls } = makeCtx(400, 400);
    renderCanvas(ctx, {
      canvasWidth: 20,
      canvasHeight: 20,
      lines,
      offsetX: 0,
      offsetY: 0,
      cellSize: 1,
    });
    // Three user lines → three fillRect calls. No stroke calls (all gates closed).
    expect(countCalls(calls, 'fillRect')).toBe(3);
    expect(countCalls(calls, 'stroke')).toBe(0);
  });
});

describe('renderer — viewport culling', () => {
  it('1000x1000 grid at cellSize=2 in 800x600 viewport iterates ~viewport, not 1M cells', () => {
    // Build a colored grid: every cell highlighted. The cell-highlight loop
    // calls fillRect once per visited cell; counting fillRects measures
    // iteration count.
    const { ctx, calls } = makeCtx(800, 600);
    renderCanvas(ctx, {
      canvasWidth: 1000,
      canvasHeight: 1000,
      lines: new Map(),
      offsetX: 0,
      offsetY: 0,
      cellSize: 2,
      getCellColor: () => '#FF0000',
    });
    const fillRects = countCalls(calls, 'fillRect');
    // Visible region: viewport ÷ cellSize ≈ 400 × 300 = 120k cells, plus
    // small ±1 padding. Definitely not 1M (1000×1000).
    expect(fillRects).toBeLessThan(200_000);
    expect(fillRects).toBeGreaterThan(0);
  });

  it('boundary cells visible at fractional offset are not clipped', () => {
    // Compare integer vs. fractional offset. The fractional render must
    // include at least as many cells as the integer render — the ±1
    // padding is the safety net that prevents off-by-one clipping.
    const renderAt = (offsetX: number, offsetY: number) => {
      const { ctx, calls } = makeCtx(200, 200);
      renderCanvas(ctx, {
        canvasWidth: 30,
        canvasHeight: 30,
        lines: new Map(),
        offsetX,
        offsetY,
        cellSize: 4,
        getCellColor: () => '#00FF00',
      });
      return countCalls(calls, 'fillRect');
    };

    const integerOffset = renderAt(0, 0);
    const fractionalOffset = renderAt(-1.5, -1.5);
    // Allow up to 2-cell-row delta for padding asymmetry, but never *fewer*
    // than the integer-offset render minus a small slop.
    expect(fractionalOffset).toBeGreaterThanOrEqual(integerOffset - 60);
  });
});

describe('renderer — hiddenLineKeys still respected at any cellSize', () => {
  it('skips hidden line keys in stroke mode', () => {
    const lines = seedLines([
      { x: 1, y: 1, orientation: 'horizontal' },
      { x: 2, y: 2, orientation: 'horizontal' },
    ]);
    const { ctx, calls } = makeCtx(400, 400);
    renderCanvas(ctx, {
      canvasWidth: 10,
      canvasHeight: 10,
      lines,
      offsetX: 0,
      offsetY: 0,
      cellSize: 25,
      hiddenLineKeys: new Set([getLineKey(1, 1, 'horizontal')]),
    });
    // beginPath fires once per drawn user line. Grid/tails also call
    // beginPath, so we count ONLY user lines via the line-segment moveTo
    // pattern: user lines are the only call paths that stroke after
    // exactly one beginPath+moveTo+lineTo. Easier: count lineTo calls
    // attributed to user lines vs. grid lines.
    // Simpler: hiddenLineKeys reducing user-line count by 1 means
    // (allDraws - oneHidden) matches a re-render with one fewer line.
    const linesNoHidden = seedLines([
      { x: 2, y: 2, orientation: 'horizontal' },
    ]);
    const { ctx: ctx2, calls: calls2 } = makeCtx(400, 400);
    renderCanvas(ctx2, {
      canvasWidth: 10,
      canvasHeight: 10,
      lines: linesNoHidden,
      offsetX: 0,
      offsetY: 0,
      cellSize: 25,
    });
    expect(countCalls(calls, 'stroke')).toBe(countCalls(calls2, 'stroke'));
  });

  it('skips hidden line keys in fillRect mode (cellSize<1.5)', () => {
    const lines = seedLines([
      { x: 1, y: 1, orientation: 'horizontal' },
      { x: 2, y: 2, orientation: 'horizontal' },
    ]);
    const { ctx, calls } = makeCtx(400, 400);
    renderCanvas(ctx, {
      canvasWidth: 10,
      canvasHeight: 10,
      lines,
      offsetX: 0,
      offsetY: 0,
      cellSize: 1,
      hiddenLineKeys: new Set([getLineKey(1, 1, 'horizontal')]),
    });
    expect(countCalls(calls, 'fillRect')).toBe(1);
  });
});
