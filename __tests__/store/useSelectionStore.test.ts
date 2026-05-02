import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/store/useCanvasStore';
import { useSelectionStore } from '../../src/store/useSelectionStore';
import {
  cellKey,
  fromRect,
} from '../../src/utils/canvas/selection/maskUtils';
import { getLineKey } from '../../src/types';
import type { Line } from '../../src/types';

const W = 20;
const H = 20;

const seedLines = (entries: Array<Omit<Line, 'color'> & { color?: string }>) => {
  const map = new Map<string, Line>();
  for (const e of entries) {
    const line: Line = { ...e, color: e.color ?? '#000000' };
    map.set(getLineKey(e.x, e.y, e.orientation), line);
  }
  useCanvasStore.setState({ lines: map });
};

beforeEach(() => {
  useCanvasStore.setState({
    width: W,
    height: H,
    lines: new Map(),
    highlights: [],
    currentColor: '#000000',
  });
  useCanvasStore.temporal.getState().clear();
  useSelectionStore.setState({
    tool: 'draw',
    selection: null,
    refineMode: 'replace',
    ghost: null,
    clipboard: null,
    axisPicker: null,
    marqueePreview: null,
  });
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('weaving-scheme-clipboard');
  }
});

describe('tool switching clears selection state', () => {
  it('switching to a select tool from draw is clean', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    expect(useSelectionStore.getState().selection?.size).toBe(4);
    useSelectionStore.getState().setTool('select-rect');
    // Tool switch CLEARS selection (image-editor convention)
    expect(useSelectionStore.getState().selection).toBeNull();
  });

  it('switching back to draw clears any active ghost', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    useSelectionStore.getState().setTool('select-rect');
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    // Need lines to make beginMoveGhost succeed
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useSelectionStore.getState().beginMoveGhost();
    expect(useSelectionStore.getState().ghost).not.toBeNull();
    useSelectionStore.getState().setTool('draw');
    expect(useSelectionStore.getState().selection).toBeNull();
    expect(useSelectionStore.getState().ghost).toBeNull();
  });
});

describe('setSelection refinement modes', () => {
  it('replace overwrites prior selection', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 2, 2));
    useSelectionStore.getState().setSelection(fromRect(5, 5, 6, 6), 'replace');
    const sel = useSelectionStore.getState().selection!;
    expect(sel.has(cellKey(0, 0))).toBe(false);
    expect(sel.has(cellKey(5, 5))).toBe(true);
  });

  it('add unions with prior selection', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 0)); // 2 cells
    useSelectionStore.getState().setSelection(fromRect(3, 0, 4, 0), 'add');
    expect(useSelectionStore.getState().selection?.size).toBe(4);
  });

  it('subtract removes overlap', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 4, 0)); // 5 cells
    useSelectionStore
      .getState()
      .setSelection(fromRect(1, 0, 2, 0), 'subtract');
    expect(useSelectionStore.getState().selection?.size).toBe(3);
  });

  it('subtracting everything clears selection to null', () => {
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 0));
    useSelectionStore
      .getState()
      .setSelection(fromRect(0, 0, 1, 0), 'subtract');
    expect(useSelectionStore.getState().selection).toBeNull();
  });
});

describe('move flow', () => {
  it('beginMoveGhost + adjust + commit moves lines and records one zundo entry', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 0, y: 1, orientation: 'horizontal' },
      { x: 0, y: 0, orientation: 'vertical' },
      { x: 1, y: 0, orientation: 'vertical' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));
    useSelectionStore.getState().beginMoveGhost();
    expect(useSelectionStore.getState().ghost?.kind).toBe('move');

    // Move 5 cells right
    useSelectionStore.getState().adjustGhost(5, 0);
    const beforeCommit = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().commitGhost();
    const afterCommit = useCanvasStore.temporal.getState().pastStates.length;
    expect(afterCommit - beforeCommit).toBe(1);

    const lines = useCanvasStore.getState().lines;
    expect(lines.has(getLineKey(0, 0, 'horizontal'))).toBe(false);
    expect(lines.has(getLineKey(5, 0, 'horizontal'))).toBe(true);

    expect(useSelectionStore.getState().ghost).toBeNull();
    expect(useSelectionStore.getState().selection?.has(cellKey(5, 0))).toBe(
      true,
    );
  });

  it('cancelGhost restores nothing was committed', () => {
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));
    useSelectionStore.getState().beginMoveGhost();
    useSelectionStore.getState().adjustGhost(5, 0);

    const beforeCancel = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().cancelGhost();
    expect(useCanvasStore.temporal.getState().pastStates.length).toBe(
      beforeCancel,
    );
    expect(
      useCanvasStore.getState().lines.has(getLineKey(0, 0, 'horizontal')),
    ).toBe(true);
    expect(useSelectionStore.getState().ghost).toBeNull();
  });
});

describe('composable transforms — single zundo entry per composition', () => {
  it('flip + rotate + adjust + commit = one zundo entry', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 1, y: 0, orientation: 'horizontal' },
      { x: 0, y: 1, orientation: 'horizontal' },
      { x: 0, y: 0, orientation: 'vertical' },
      { x: 0, y: 1, orientation: 'vertical' },
      { x: 1, y: 0, orientation: 'vertical' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 0));
    // Compose: flipH (creates ghost) → rotate CW → adjust → commit
    useSelectionStore.getState().applyFlipHorizontal();
    useSelectionStore.getState().applyRotate('cw');
    useSelectionStore.getState().adjustGhost(2, 2);

    const before = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().commitGhost();
    const after = useCanvasStore.temporal.getState().pastStates.length;
    expect(after - before).toBe(1);
  });

  it('canceling a composition writes zero zundo entries', () => {
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));
    useSelectionStore.getState().applyRotate('cw');
    useSelectionStore.getState().applyFlipVertical();

    const before = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().cancelGhost();
    expect(useCanvasStore.temporal.getState().pastStates.length).toBe(before);
  });

  it('first transform from selection lazily creates the ghost', () => {
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));
    expect(useSelectionStore.getState().ghost).toBeNull();
    useSelectionStore.getState().applyFlipHorizontal();
    expect(useSelectionStore.getState().ghost).not.toBeNull();
    expect(useSelectionStore.getState().ghost?.kind).toBe('move');
  });
});

describe('copy / cut / paste', () => {
  it('cut removes lines and stores them in clipboard (one zundo step)', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 0, y: 1, orientation: 'horizontal' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));

    const before = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().cutSelection();
    const after = useCanvasStore.temporal.getState().pastStates.length;
    expect(after - before).toBe(1);

    expect(
      useCanvasStore.getState().lines.has(getLineKey(0, 0, 'horizontal')),
    ).toBe(false);
    expect(useSelectionStore.getState().clipboard).not.toBeNull();
    expect(useSelectionStore.getState().selection).toBeNull();
  });

  it('paste creates a paste-ghost, commit adds lines (one zundo step)', () => {
    // Manually set clipboard
    useSelectionStore.setState({
      clipboard: {
        lines: [{ x: 0, y: 0, orientation: 'horizontal', color: '#abc' }],
        bbox: { width: 1, height: 1 },
      },
    });
    useSelectionStore.getState().pasteFromClipboard();
    const ghost = useSelectionStore.getState().ghost;
    expect(ghost?.kind).toBe('paste');
    expect(ghost?.sourceMask).toBeNull();

    const before = useCanvasStore.temporal.getState().pastStates.length;
    useSelectionStore.getState().commitGhost();
    expect(useCanvasStore.temporal.getState().pastStates.length - before).toBe(
      1,
    );
  });

  it('paste origin uses selection bbox top-left when selection exists', () => {
    useSelectionStore.setState({
      clipboard: {
        lines: [{ x: 0, y: 0, orientation: 'horizontal', color: '#000' }],
        bbox: { width: 1, height: 1 },
      },
    });
    useSelectionStore.getState().setSelection(fromRect(7, 5, 7, 5));
    useSelectionStore.getState().pasteFromClipboard();
    const ghost = useSelectionStore.getState().ghost!;
    expect(ghost.lines[0].x).toBe(7);
    expect(ghost.lines[0].y).toBe(5);
  });

  it('clipboard preserves full fragment after off-canvas commit', () => {
    useSelectionStore.setState({
      clipboard: {
        lines: [
          { x: 0, y: 0, orientation: 'horizontal', color: '#000' },
          { x: 1, y: 0, orientation: 'horizontal', color: '#000' },
        ],
        bbox: { width: 2, height: 1 },
      },
    });
    useSelectionStore.getState().pasteFromClipboard();
    // Push ghost so first line falls off the canvas (negative x)
    useSelectionStore.getState().adjustGhost(-2, 0);
    useSelectionStore.getState().commitGhost();
    // Clipboard untouched
    const cb = useSelectionStore.getState().clipboard!;
    expect(cb.lines.length).toBe(2);
    expect(cb.bbox.width).toBe(2);
  });
});

describe('CellHighlights are not affected by move', () => {
  it('row highlight remains in place after move + commit', () => {
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useCanvasStore.setState({
      highlights: [
        { type: 'row', index: 0, color: '#ffeecc', timestamp: 1 },
      ],
    });
    useSelectionStore.getState().setSelection(fromRect(0, 0, 0, 0));
    useSelectionStore.getState().beginMoveGhost();
    useSelectionStore.getState().adjustGhost(5, 0);
    useSelectionStore.getState().commitGhost();
    const highlights = useCanvasStore.getState().highlights;
    expect(highlights.length).toBe(1);
    expect(highlights[0].index).toBe(0); // still on row 0
  });
});

describe('canvas resize clears selection', () => {
  it('resizeCanvas clears active selection and ghost', () => {
    seedLines([{ x: 0, y: 0, orientation: 'horizontal' }]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    useSelectionStore.getState().beginMoveGhost();
    expect(useSelectionStore.getState().selection).not.toBeNull();
    expect(useSelectionStore.getState().ghost).not.toBeNull();
    useCanvasStore.getState().resizeCanvas('right', 1);
    expect(useSelectionStore.getState().selection).toBeNull();
    expect(useSelectionStore.getState().ghost).toBeNull();
  });
});

describe('off-canvas clip on commit', () => {
  it('lines pushed off-canvas are dropped, in-bounds portion lands', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 1, y: 0, orientation: 'horizontal' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 0));
    useSelectionStore.getState().beginMoveGhost();
    // Push left: x=0 stays at 0 if dx=0; let's push so first goes to x=-1
    useSelectionStore.getState().adjustGhost(-1, 0);
    useSelectionStore.getState().commitGhost();
    const lines = useCanvasStore.getState().lines;
    // x=-1 dropped; x=0 (was x=1) remains
    expect(lines.has(getLineKey(-1, 0, 'horizontal'))).toBe(false);
    expect(lines.has(getLineKey(0, 0, 'horizontal'))).toBe(true);
    expect(lines.has(getLineKey(1, 0, 'horizontal'))).toBe(false);
  });
});

describe('rotation around bbox center', () => {
  it('applyRotate cw on a square selection swaps appropriate cells', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 0, y: 0, orientation: 'vertical' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    useSelectionStore.getState().applyRotate('cw');
    const ghost = useSelectionStore.getState().ghost!;
    expect(ghost.kind).toBe('move');
    expect(ghost.lines.length).toBe(2);
    // Orientation flipped: 'horizontal' → 'vertical' and vice versa
    const orientations = ghost.lines.map((l) => l.orientation).sort();
    expect(orientations).toEqual(['horizontal', 'vertical']);
  });

  it('four CW rotations on a ghost are identity', () => {
    seedLines([
      { x: 0, y: 0, orientation: 'horizontal' },
      { x: 1, y: 1, orientation: 'horizontal' },
      { x: 0, y: 1, orientation: 'vertical' },
    ]);
    useSelectionStore.getState().setSelection(fromRect(0, 0, 1, 1));
    useSelectionStore.getState().beginMoveGhost();
    const before = useSelectionStore.getState().ghost!;
    const initialKeys = new Set(
      before.lines.map((l) => getLineKey(l.x, l.y, l.orientation)),
    );
    useSelectionStore.getState().applyRotate('cw');
    useSelectionStore.getState().applyRotate('cw');
    useSelectionStore.getState().applyRotate('cw');
    useSelectionStore.getState().applyRotate('cw');
    const after = useSelectionStore.getState().ghost!;
    const finalKeys = new Set(
      after.lines.map((l) => getLineKey(l.x, l.y, l.orientation)),
    );
    expect(finalKeys).toEqual(initialKeys);
  });
});
