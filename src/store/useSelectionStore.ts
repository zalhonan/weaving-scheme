import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  ClipboardEntry,
  GhostState,
  Line,
  MirrorAxis,
  RefineMode,
  SelectionMask,
  Tool,
} from '../types';
import { useCanvasStore } from './useCanvasStore';
import {
  bbox,
  fromRect,
  mirrorMask,
  subtract,
  translate as translateMask,
  union,
} from '../utils/canvas/selection/maskUtils';
import { getLinesInMask } from '../utils/canvas/selection/derivedLines';
import {
  mirrorLines,
  normalizeToOrigin,
  translateLines,
} from '../utils/canvas/selection/transforms';

/**
 * Live preview of an in-progress marquee/lasso drag. Pure UI feedback —
 * not the committed selection. Cleared on drag-end (which calls setSelection).
 */
export interface MarqueePreview {
  kind: 'rect' | 'lasso';
  /** For rect: anchor cell + current cell. For lasso: list of polygon points (grid coords). */
  rect?: { x0: number; y0: number; x1: number; y1: number };
  lasso?: Array<{ x: number; y: number }>;
}

interface SelectionState {
  tool: Tool;
  selection: SelectionMask | null;
  refineMode: RefineMode;
  ghost: GhostState | null;
  clipboard: ClipboardEntry | null;
  axisPicker: { active: boolean } | null;
  marqueePreview: MarqueePreview | null;
}

interface SelectionActions {
  setTool: (tool: Tool) => void;
  setRefineMode: (mode: RefineMode) => void;
  setSelection: (mask: SelectionMask, mode?: RefineMode) => void;
  clearSelection: () => void;
  clearAll: () => void;
  setMarqueePreview: (preview: MarqueePreview | null) => void;

  beginMoveGhost: () => void;
  beginPasteGhost: (originCell?: { x: number; y: number }) => void;
  beginMirrorGhost: (axis: MirrorAxis) => void;
  adjustGhost: (dx: number, dy: number) => void;
  cancelGhost: () => void;
  commitGhost: () => void;

  copySelection: () => void;
  cutSelection: () => void;
  pasteFromClipboard: (originCell?: { x: number; y: number }) => void;

  beginAxisPicker: () => void;
  confirmAxis: (axis: MirrorAxis) => void;
  cancelAxisPicker: () => void;
}

type SelectionStore = SelectionState & SelectionActions;

const initialState: SelectionState = {
  tool: 'draw',
  selection: null,
  refineMode: 'replace',
  ghost: null,
  clipboard: null,
  axisPicker: null,
  marqueePreview: null,
};

/**
 * Compute how far the ghost can be translated by (dx, dy) without any line
 * leaving the canvas. Returns the clamped delta. (Each line's allowed range
 * depends on its orientation: horizontal x ∈ [0, width-1], y ∈ [0, height];
 * vertical x ∈ [0, width], y ∈ [0, height-1].)
 */
const clampGhostDelta = (
  lines: Line[],
  dx: number,
  dy: number,
  width: number,
  height: number,
): { dx: number; dy: number } => {
  let cdx = dx;
  let cdy = dy;
  for (const line of lines) {
    const xMax = line.orientation === 'horizontal' ? width - 1 : width;
    const yMax = line.orientation === 'horizontal' ? height : height - 1;
    if (line.x + cdx < 0) cdx = -line.x;
    if (line.x + cdx > xMax) cdx = xMax - line.x;
    if (line.y + cdy < 0) cdy = -line.y;
    if (line.y + cdy > yMax) cdy = yMax - line.y;
  }
  return { dx: cdx, dy: cdy };
};

/**
 * Build a cell-mask covering the bbox of a clipboard's normalized lines,
 * translated by (offsetX, offsetY). Used as the destination mask for paste.
 */
const pasteFootprintMask = (
  clipboard: ClipboardEntry,
  offsetX: number,
  offsetY: number,
): SelectionMask => {
  if (clipboard.bbox.width <= 0 || clipboard.bbox.height <= 0) {
    return new Set();
  }
  return fromRect(
    offsetX,
    offsetY,
    offsetX + clipboard.bbox.width - 1,
    offsetY + clipboard.bbox.height - 1,
  );
};

const CLIPBOARD_STORAGE_KEY = 'weaving-scheme-clipboard';

export const useSelectionStore = create<SelectionStore>()(
  persist<SelectionStore, [], [], { clipboard: ClipboardEntry | null }>(
    (set, get) => ({
  ...initialState,

  setTool: (tool) => {
    // Tool switch cancels any in-progress selection or operation.
    set({
      tool,
      selection: null,
      ghost: null,
      axisPicker: null,
      marqueePreview: null,
    });
  },

  setRefineMode: (refineMode) => set({ refineMode }),

  setMarqueePreview: (marqueePreview) => set({ marqueePreview }),

  setSelection: (mask, mode) => {
    const effectiveMode = mode ?? get().refineMode;
    const current = get().selection;
    let next: SelectionMask;
    if (current === null || effectiveMode === 'replace') {
      next = new Set(mask);
    } else if (effectiveMode === 'add') {
      next = union(current, mask);
    } else {
      next = subtract(current, mask);
    }
    set({ selection: next.size === 0 ? null : next, ghost: null });
  },

  clearSelection: () => set({ selection: null, marqueePreview: null }),

  clearAll: () =>
    set({
      selection: null,
      ghost: null,
      axisPicker: null,
      marqueePreview: null,
    }),

  beginMoveGhost: () => {
    const { selection } = get();
    if (selection === null) return;
    const { lines: allLines } = useCanvasStore.getState();
    const selectedLines = getLinesInMask(selection, allLines);
    if (selectedLines.length === 0) return;
    set({
      ghost: {
        kind: 'move',
        lines: selectedLines.map((l) => ({ ...l })),
        sourceMask: new Set(selection),
        destMask: new Set(selection),
      },
      axisPicker: null,
    });
  },

  beginPasteGhost: (originCell) => {
    const { clipboard, selection } = get();
    if (clipboard === null || clipboard.lines.length === 0) return;
    const { width, height } = useCanvasStore.getState();
    // Origin priority:
    //   1. Explicit `originCell` (e.g. cursor position from a future
    //      cursor-aware paste).
    //   2. Top-left of the active selection bbox — paste lands "where I'm
    //      looking" (image-editor convention).
    //   3. (1, 1) from canvas origin so the floating layer is visible.
    let ox: number;
    let oy: number;
    if (originCell) {
      ox = originCell.x;
      oy = originCell.y;
    } else if (selection) {
      const b = bbox(selection);
      if (b) {
        ox = b.minX;
        oy = b.minY;
      } else {
        ox = 1;
        oy = 1;
      }
    } else {
      ox = 1;
      oy = 1;
    }
    // Clamp so the bbox fits inside the canvas.
    if (ox + clipboard.bbox.width > width) ox = Math.max(0, width - clipboard.bbox.width);
    if (oy + clipboard.bbox.height > height) oy = Math.max(0, height - clipboard.bbox.height);
    if (ox < 0) ox = 0;
    if (oy < 0) oy = 0;
    set({
      ghost: {
        kind: 'paste',
        lines: translateLines(clipboard.lines, ox, oy).map((l) => ({ ...l })),
        sourceMask: null,
        destMask: pasteFootprintMask(clipboard, ox, oy),
      },
      axisPicker: null,
    });
  },

  beginMirrorGhost: (axis) => {
    const { selection } = get();
    if (selection === null) return;
    const { lines: allLines } = useCanvasStore.getState();
    const selectedLines = getLinesInMask(selection, allLines);
    if (selectedLines.length === 0) return;
    set({
      ghost: {
        kind: 'mirror',
        lines: mirrorLines(selectedLines, axis),
        sourceMask: new Set(selection),
        destMask: mirrorMask(selection, axis),
      },
      axisPicker: null,
    });
  },

  adjustGhost: (dx, dy) => {
    const { ghost } = get();
    if (ghost === null) return;
    const { width, height } = useCanvasStore.getState();
    const { dx: cdx, dy: cdy } = clampGhostDelta(ghost.lines, dx, dy, width, height);
    if (cdx === 0 && cdy === 0) return;
    set({
      ghost: {
        ...ghost,
        lines: translateLines(ghost.lines, cdx, cdy),
        destMask: translateMask(ghost.destMask, cdx, cdy),
      },
    });
  },

  cancelGhost: () => set({ ghost: null }),

  commitGhost: () => {
    const { ghost } = get();
    if (ghost === null) return;
    const canvas = useCanvasStore.getState();

    if (ghost.kind === 'move') {
      const removed = ghost.sourceMask
        ? getLinesInMask(ghost.sourceMask, canvas.lines)
        : [];
      canvas.applyMove(removed, ghost.lines);
    } else if (ghost.kind === 'paste') {
      canvas.applyPaste(ghost.lines);
    } else {
      const removed = ghost.sourceMask
        ? getLinesInMask(ghost.sourceMask, canvas.lines)
        : [];
      canvas.applyMirror(removed, ghost.lines);
    }
    set({
      ghost: null,
      selection: ghost.destMask.size === 0 ? null : new Set(ghost.destMask),
    });
  },

  copySelection: () => {
    const { selection } = get();
    if (selection === null) return;
    const canvas = useCanvasStore.getState();
    const lines = getLinesInMask(selection, canvas.lines);
    if (lines.length === 0) return;
    const normalized = normalizeToOrigin(lines);
    set({
      clipboard: {
        lines: normalized,
        bbox: clipboardBboxFromMask(selection),
      },
    });
  },

  cutSelection: () => {
    const { selection } = get();
    if (selection === null) return;
    const canvas = useCanvasStore.getState();
    const lines = getLinesInMask(selection, canvas.lines);
    if (lines.length === 0) return;
    const normalized = normalizeToOrigin(lines);
    set({
      clipboard: {
        lines: normalized,
        bbox: clipboardBboxFromMask(selection),
      },
    });
    canvas.applyDelete(lines);
    set({ selection: null });
  },

  pasteFromClipboard: (originCell) => {
    get().beginPasteGhost(originCell);
  },

  beginAxisPicker: () => {
    if (get().selection === null) return;
    set({ axisPicker: { active: true } });
  },

  confirmAxis: (axis) => {
    const { axisPicker } = get();
    if (axisPicker === null || !axisPicker.active) return;
    set({ axisPicker: null });
    get().beginMirrorGhost(axis);
  },

  cancelAxisPicker: () => set({ axisPicker: null }),
}),
    {
      name: CLIPBOARD_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      // Persist ONLY the clipboard. Selection / ghost / tool / refineMode
      // / axisPicker / marqueePreview stay session-only.
      partialize: (state) => ({ clipboard: state.clipboard }),
    },
  ),
);

/**
 * Clipboard bbox is the cell-mask bbox (cells), not the line bbox.
 * Falls back to clipboardBbox of normalized lines if the mask is empty.
 */
function clipboardBboxFromMask(mask: SelectionMask): { width: number; height: number } {
  const b = bbox(mask);
  if (b === null) return { width: 0, height: 0 };
  return { width: b.width, height: b.height };
}

// ---------------------------------------------------------------------------
// Cross-store coupling: clear selection when canvas size changes.
// We subscribe here (not inside useCanvasStore) so the canvas store stays
// unaware of selection — one-way dependency.
// ---------------------------------------------------------------------------
let lastCanvasSize = {
  width: useCanvasStore.getState().width,
  height: useCanvasStore.getState().height,
};
useCanvasStore.subscribe((state) => {
  if (state.width !== lastCanvasSize.width || state.height !== lastCanvasSize.height) {
    lastCanvasSize = { width: state.width, height: state.height };
    useSelectionStore.getState().clearAll();
  }
});

// ---------------------------------------------------------------------------
// Cross-tab clipboard sync. The persist middleware writes to localStorage on
// every state change; the `storage` event fires in OTHER tabs of the same
// origin, letting us mirror clipboard updates between editor windows.
// JSON.stringify equality guards against feedback loops if a browser fires
// `storage` for same-value writes.
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CLIPBOARD_STORAGE_KEY) return;
    let next: ClipboardEntry | null = null;
    if (e.newValue) {
      try {
        const parsed = JSON.parse(e.newValue) as { state?: { clipboard?: ClipboardEntry | null } };
        next = parsed.state?.clipboard ?? null;
      } catch {
        return;
      }
    }
    const current = useSelectionStore.getState().clipboard;
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      useSelectionStore.setState({ clipboard: next });
    }
  });
}

