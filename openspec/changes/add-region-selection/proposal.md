# add-region-selection

## Why

The pattern editor currently supports only single-line operations. Designing
larger weaving / cross-stitch schemes requires repeatable structural edits —
moving a motif, duplicating a block, mirroring a panel — each of which is
infeasible to do line-by-line. This change introduces a region-selection
primitive and the basic transforms users have asked for via
`documentation/tz2.md` (copy region, mirror region) plus the natural
extensions: move and delete.

## What Changes

- selection: add `Tool` mode (`draw` | `select-rect` | `select-lasso`); modifier
  keys (`Shift`, `Ctrl`) are reinterpreted per active tool.
- selection: add rectangle and lasso selection drawing, with `Shift` (add) and
  `Ctrl`/`Cmd` (subtract) refinement on desktop and a tri-state Replace/Add/Subtract
  toggle on touch.
- selection: add marching-ants visualization, drawn on a new dedicated overlay
  `<canvas>` so the static pattern canvas does not redraw at 60 fps.
- selection: add Move (drag inside selection bbox + arrow keys for cell-by-cell
  nudge), with floating-ghost preview that commits on `Enter` and cancels on
  `Escape`.
- selection: add Delete that removes all lines belonging to the selection
  (inclusive boundary semantics).
- selection: add Copy / Cut / Paste with a session clipboard. Paste produces
  a floating ghost the user positions before commit.
- selection: add Mirror with an axis picker (click any horizontal or vertical
  grid line to set the axis) plus quick presets Flip-H and Flip-V that mirror
  around the selection bbox center.
- selection: add Rotate 90° clockwise and counter-clockwise. Rotation pivots
  around the selection bbox center, swaps line orientation (horizontal ↔
  vertical), and is presented as a floating layer like move/mirror.
- canvas: split the rendering pipeline into a static layer (existing) and an
  overlay layer (new) for ghost and ants. `pointer-events: none` on overlay so
  input still reaches the static canvas.
- store: add `useSelectionStore` (session-only, not persisted, not undoable).
  Add `applyMove`, `applyDelete`, `applyPaste`, `applyMirror` actions on
  `useCanvasStore` — each is a single undoable transaction.

## Impact

- **Affected specs:** new capability `selection` (spec added by this change).
- **Affected code areas:**
  - `src/types/selection.ts` (new)
  - `src/store/useSelectionStore.ts` (new)
  - `src/store/useCanvasStore.ts` (new actions only; existing surface unchanged)
  - `src/utils/canvas/selection/*` (new utilities: mask, derived lines,
    transforms, lasso smoothing, marching-ants tracing)
  - `src/components/Canvas/Canvas.tsx` (overlay canvas), new
    `useOverlayRenderer.ts`, edits to `useCanvasInteraction.ts` and
    `useCanvasTouchInteraction.ts` to branch on tool
  - `src/components/Sidebar/*` (tool buttons + ops section + hotkeys),
    `MobileToolbar.tsx`, `GestureHints.tsx`
- **Persisted localStorage migration:** the existing `useCanvasStore` shape
  (`width`, `height`, `lines`, `highlights`, `currentColor`) is **unchanged** —
  new actions only mutate `lines`, so undo/redo behavior is preserved. A
  **new** persisted key `weaving-scheme-clipboard` is introduced by the
  `useSelectionStore`, holding **only** the `clipboard` slice. The clipboard
  persists across page reloads and across same-origin tabs (cross-tab sync
  via the `storage` event). Selection, ghost, axis-picker, and tool state
  remain session-only. No migration is required because the clipboard key
  is brand new — a missing entry simply means an empty clipboard.
- **Desktop behavior:** mouse drag for marquee/lasso; `Shift` adds, `Ctrl`/`Cmd`
  subtracts; arrow keys nudge ghost cell-by-cell; keyboard shortcuts for ops
  (`V` select / `B` brush, `Delete`, `Ctrl/Cmd+C/X/V`, `Enter`, `Escape`).
- **Touch behavior:** new tool toggle in `MobileToolbar`; tri-state
  Replace/Add/Subtract toggle replaces modifier keys; on-screen op buttons
  (Move, Delete, Copy, Cut, Paste, Flip-H, Flip-V, Mirror, Confirm, Cancel)
  appear contextually when a selection or ghost exists; arrow-nudge buttons
  while ghost is active. Finger-lift never auto-commits — commit is always an
  explicit Confirm tap.

## Non-Goals

- Rotation by arbitrary angle (only 90° CW / 90° CCW are in scope; 180°
  can be reached via two 90° rotations).
- Multi-clipboard / clipboard history (only one entry; new copy/cut overwrites).
- Operating on `CellHighlight` row/column overlays — they remain stationary
  even when a selection covers them.
- Selecting individual lines without a region (the hybrid model uses cells as
  the selection unit; lines are derived).
- Lasso point editing after release (lasso commits to a cell-set immediately
  on release).
- Snapping ghost to grid landmarks beyond cell-boundary alignment.
