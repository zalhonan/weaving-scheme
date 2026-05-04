import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/store/useCanvasStore';
import { useViewportStore } from '../../src/store/useViewportStore';
import { VIEWPORT_LIMITS } from '../../src/types/viewport';
import { CANVAS_CONSTANTS } from '../../src/constants';

const W = 1000;
const H = 1000;

beforeEach(() => {
  useCanvasStore.setState({
    width: W,
    height: H,
    lines: new Map(),
    highlights: [],
    currentColor: '#000000',
  });
  useViewportStore.setState({
    offsetX: 0,
    offsetY: 0,
    cellSize: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,
  });
});

describe('useViewportStore — session-only persistence', () => {
  it('does not write any viewport key to localStorage when state mutates', () => {
    const before = Object.keys(localStorage).filter((k) =>
      k.toLowerCase().includes('viewport')
    );
    expect(before).toHaveLength(0);

    useViewportStore.getState().pan(10, 20);
    useViewportStore.getState().zoom(1.5, 100, 100);

    const after = Object.keys(localStorage).filter((k) =>
      k.toLowerCase().includes('viewport')
    );
    expect(after).toHaveLength(0);
  });
});

describe('useViewportStore — multiplicative zoom', () => {
  it('multiplies cellSize by the factor', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    useViewportStore.getState().zoom(1.08, 0, 0);
    expect(useViewportStore.getState().cellSize).toBeCloseTo(27, 5);
  });

  it('clamps to MIN_CELL_SIZE on extreme zoom-out', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    // Apply factor 0.001 — would land at 0.025 without clamp.
    useViewportStore.getState().zoom(0.001, 0, 0);
    expect(useViewportStore.getState().cellSize).toBe(
      VIEWPORT_LIMITS.MIN_CELL_SIZE
    );
  });

  it('clamps to MAX_CELL_SIZE on extreme zoom-in', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    useViewportStore.getState().zoom(1000, 0, 0);
    expect(useViewportStore.getState().cellSize).toBe(
      VIEWPORT_LIMITS.MAX_CELL_SIZE
    );
  });

  it('is a no-op when factor==1 (already-clamped state should not jitter)', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 5, offsetY: 7 });
    useViewportStore.getState().zoom(1, 100, 100);
    expect(useViewportStore.getState().cellSize).toBe(25);
    expect(useViewportStore.getState().offsetX).toBe(5);
    expect(useViewportStore.getState().offsetY).toBe(7);
  });

  it('felt-step at default zoom matches legacy ±2 within 10%', () => {
    // Pre-change: cellSize 25 + 2 = 27. New: 25 * 1.08 = 27.
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    useViewportStore.getState().zoom(1.08, 0, 0);
    const newSize = useViewportStore.getState().cellSize;
    expect(Math.abs(newSize - 27)).toBeLessThan(2.7); // within 10% of 27
  });
});

describe('useViewportStore — cursor-anchor invariant preserved', () => {
  // The pre-change anchor math is screen-relative:
  //   (cursorX - offsetX) / cellSize == const  across the zoom event.
  // (Not grid-relative — there is a fixed NUMBER_AREA offset that the
  // existing math intentionally absorbs into the visible drift; preserving
  // that exact behavior is the regression contract.)
  const screenRatio = (
    sx: number,
    sy: number,
    offsetX: number,
    offsetY: number,
    cellSize: number
  ) => ({
    rx: (sx - offsetX) / cellSize,
    ry: (sy - offsetY) / cellSize,
  });

  it('zooming in 5 ticks at (100,100) preserves the screen-relative ratio', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    const v0 = useViewportStore.getState();
    const before = screenRatio(100, 100, v0.offsetX, v0.offsetY, v0.cellSize);

    for (let i = 0; i < 5; i++) {
      useViewportStore.getState().zoom(1.08, 100, 100);
    }

    const vN = useViewportStore.getState();
    const after = screenRatio(100, 100, vN.offsetX, vN.offsetY, vN.cellSize);
    expect(after.rx).toBeCloseTo(before.rx, 4);
    expect(after.ry).toBeCloseTo(before.ry, 4);
  });

  it('zooming out 5 ticks at (300,250) preserves the screen-relative ratio', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 0, offsetY: 0 });
    const v0 = useViewportStore.getState();
    const before = screenRatio(300, 250, v0.offsetX, v0.offsetY, v0.cellSize);

    for (let i = 0; i < 5; i++) {
      useViewportStore.getState().zoom(1 / 1.08, 300, 250);
    }

    const vN = useViewportStore.getState();
    const after = screenRatio(300, 250, vN.offsetX, vN.offsetY, vN.cellSize);
    expect(after.rx).toBeCloseTo(before.rx, 4);
    expect(after.ry).toBeCloseTo(before.ry, 4);
  });

  it('round-trip zoom in then out lands on the same screen-relative ratio', () => {
    useViewportStore.setState({ cellSize: 25, offsetX: 5, offsetY: 7 });
    const v0 = useViewportStore.getState();
    const before = screenRatio(200, 150, v0.offsetX, v0.offsetY, v0.cellSize);

    useViewportStore.getState().zoom(1.5, 200, 150);
    useViewportStore.getState().zoom(1 / 1.5, 200, 150);

    const vN = useViewportStore.getState();
    const after = screenRatio(200, 150, vN.offsetX, vN.offsetY, vN.cellSize);
    expect(after.rx).toBeCloseTo(before.rx, 4);
    expect(after.ry).toBeCloseTo(before.ry, 4);
  });
});

describe('useViewportStore — fitToView', () => {
  it('fits a 1000x1000 grid into a 1200x800 viewport, clamped to floor', () => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), width: 1000, height: 1000 });

    useViewportStore.getState().fitToView(1200, 800);

    const v = useViewportStore.getState();
    // height-fit: (800 - 30 - 32) / 1000 = 0.738
    // width-fit:  (1200 - 30 - 32) / 1000 = 1.138
    // min = 0.738 — above MIN_CELL_SIZE of 0.5
    expect(v.cellSize).toBeCloseTo(0.738, 2);
  });

  it('fits a tiny 5x5 grid clamped to DEFAULT_CELL_SIZE (no zoom-in past default)', () => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), width: 5, height: 5 });

    useViewportStore.getState().fitToView(1200, 800);

    const v = useViewportStore.getState();
    expect(v.cellSize).toBe(VIEWPORT_LIMITS.DEFAULT_CELL_SIZE);
  });

  it('centers the grid in the viewport', () => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), width: 1000, height: 1000 });

    const VW = 1200;
    const VH = 800;
    useViewportStore.getState().fitToView(VW, VH);

    const v = useViewportStore.getState();
    const numberArea = CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
    const gridPxW = 1000 * v.cellSize;
    const gridPxH = 1000 * v.cellSize;
    const expectedOffsetX = (VW - numberArea - gridPxW) / 2;
    const expectedOffsetY = (VH - numberArea - gridPxH) / 2;
    expect(v.offsetX).toBeCloseTo(expectedOffsetX, 4);
    expect(v.offsetY).toBeCloseTo(expectedOffsetY, 4);
  });

  it('handles a 100x100 grid in a 600x600 viewport (intermediate case)', () => {
    useCanvasStore.setState({ ...useCanvasStore.getState(), width: 100, height: 100 });

    useViewportStore.getState().fitToView(600, 600);

    const v = useViewportStore.getState();
    // (600 - 30 - 32) / 100 = 5.38 — below DEFAULT_CELL_SIZE, above MIN
    expect(v.cellSize).toBeCloseTo(5.38, 2);
  });
});

describe('useViewportStore — reset', () => {
  it('reset returns viewport to defaults', () => {
    useViewportStore.setState({ cellSize: 5, offsetX: 100, offsetY: 200 });
    useViewportStore.getState().reset();
    const v = useViewportStore.getState();
    expect(v.cellSize).toBe(VIEWPORT_LIMITS.DEFAULT_CELL_SIZE);
    expect(v.offsetX).toBe(0);
    expect(v.offsetY).toBe(0);
  });
});
