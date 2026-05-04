# infinite-zoom-out

## Why

The pattern editor's zoom is hard-clamped at 8 px/cell (`MIN_CELL_SIZE` in
`src/types/viewport.ts:8` and the duplicated `CANVAS_CONSTANTS.MIN_CELL_SIZE`
in `src/constants/canvas.ts:4`). Real users work with 1000×1000 schemes —
at the current floor that grid is 8030 px wide and physically cannot fit on
screen for an overview. Users need to see the whole pattern at once for
navigation and composition; editing at extreme zoom-out is **not** a goal of
this change.

Naively dropping the floor breaks four things: column/row numbers (11 px font)
overlap, "tail" UI (`cellSize × 0.5`) goes sub-pixel, minor grid lines (1 px
stroke) merge with cells, and user lines (2 px stroke) smear across multiple
cells. Performance also degrades because the renderer iterates the full
`width × height` cell grid every frame with no viewport culling — at 1000×1000
that's 1M iterations per frame even when 99 % of cells are off-screen. And
the additive zoom step (`±2` in `useCanvasInteraction.ts:595`) becomes a
100 % jump per scroll tick when `cellSize` approaches 2.

## What Changes

- viewport: lower `MIN_CELL_SIZE` from 8 to 0.5; keep `MAX_CELL_SIZE = 50`
  and `DEFAULT_CELL_SIZE = 25` unchanged.
- viewport: switch wheel/pinch zoom from additive (`cellSize ± 2`) to
  multiplicative (`cellSize × factor`) so step size remains a constant
  percentage at any scale; cursor-anchor math is preserved.
- viewport: add `fitToView()` action on `useViewportStore` that computes the
  largest `cellSize` for which the full canvas (plus number area) fits inside
  the rendered viewport, and centers the result; clamped to
  `[MIN_CELL_SIZE, DEFAULT_CELL_SIZE]` so an empty 5×5 doesn't pop to 50.
- canvas: add adaptive rendering thresholds in `renderCanvas` — column/row
  numbers, tails, minor grid, and user-line stroking each have a `cellSize`
  threshold below which they are skipped or replaced by a cheaper fallback
  (filled-rectangle line strokes when `cellSize < 1.5`).
- canvas: add viewport culling — `renderCanvas` computes the visible cell
  range from `offsetX / offsetY / cellSize / canvas dims` and iterates only
  those cells for highlights, grid, and tails. User lines are filtered in
  the same pass.
- ui: add a "Fit to view" button to the sidebar and a `0` keyboard shortcut
  bound to `useViewportStore.fitToView()`.
- constants: consolidate `VIEWPORT_LIMITS` and `CANVAS_CONSTANTS.{MIN,MAX,
  DEFAULT}_CELL_SIZE` into a single source of truth (the duplicate is a
  trip-wire — changing one without the other is a class of bug this change
  must avoid).

## Impact

- **Affected specs:** new capability `viewport` (spec added by this change).
- **Affected code areas:**
  - `src/types/viewport.ts` (change `MIN_CELL_SIZE`; consolidate)
  - `src/constants/canvas.ts` (drop duplicated cell-size constants; re-export
    from `viewport.ts` if needed)
  - `src/store/useViewportStore.ts` (new `zoom()` signature — multiplicative;
    new `fitToView(viewportWidth, viewportHeight)` action)
  - `src/utils/canvas/renderer.ts` (adaptive thresholds; viewport culling;
    filled-rect fallback for sub-pixel user lines)
  - `src/components/Canvas/useCanvasInteraction.ts` (wheel handler — pass
    factor instead of additive delta)
  - `src/components/Canvas/useCanvasTouchInteraction.ts` (pinch handler —
    align with multiplicative zoom signature)
  - `src/components/Canvas/useCanvasShortcuts.ts` (new `0` shortcut)
  - `src/components/Sidebar/Sidebar.tsx` + new
    `src/components/Sidebar/ViewControl.tsx` (Fit-to-view button)
  - `src/components/Sidebar/HotkeysInfo.tsx` (document the new shortcut)
- **Persisted localStorage migration:** **not required.** `useViewportStore`
  is session-only (`src/store/useCanvasStore.ts:7` — only the canvas store is
  persisted). Changing zoom limits, the zoom function shape, or rendering
  thresholds does not touch `weaving-scheme-storage` or
  `weaving-scheme-clipboard`. Saved schemes load identically before and after
  this change.
- **Desktop behavior:** wheel zoom is now multiplicative (constant
  percentage per tick) and reaches `cellSize = 0.5`. Middle-click pan
  unchanged. New `0` hotkey fits-to-view. New sidebar button does the same.
- **Touch behavior:** pinch-zoom signature aligns with the new
  multiplicative `zoom()` (the existing pinch math in
  `useCanvasTouchInteraction.ts:419-429` was already approximating a scale
  factor; this change makes it the actual contract). Lower floor applies
  to pinch as well. Touch users get the Fit-to-view button via the sidebar
  ☰ menu — a dedicated mobile FAB is a follow-up, not in this change.
- **Regression protection (explicit user requirement):**
  - No behavioral change at `cellSize ≥ 8`. All existing user stories
    (US-2.1 limits scaled appropriately; US-2.2, US-3.1, US-3.2, US-3.3,
    US-4.x, Эпик 7 selection ops, US-6.x touch) must keep passing.
  - Wheel "speed feel" at default zoom must match the existing additive
    step within ~10 % — the multiplicative factor is calibrated so that
    one tick at `cellSize = 25` is still ~2 px (`25 × 1.08 ≈ 27`).
  - Cursor-anchor math is preserved — zooming with the cursor over a cell
    keeps that cell under the cursor (US-2.1 acceptance criterion).
  - Numbers, tails, grid, and user lines render byte-identically at
    `cellSize ≥ 8` (visual diff or pixel-snapshot test on a fixed canvas).
  - Hit-testing thresholds are unchanged; drawing/erasing accuracy at
    normal zoom levels stays the same.
  - `npm run typecheck && npm run lint && npm run test` green; no test in
    `__tests__/` is removed or skipped.

## Non-Goals

- Editing at extreme zoom-out. Drawing, erasing, flood fill, tail clicks,
  selection marquee, and ghost drag below `cellSize ≈ 4` are explicitly NOT
  guaranteed to be ergonomic — hit zones become sub-pixel by definition.
  Users zoom out to look, then zoom back in to edit. No "lock to pan-only"
  mode is added.
- A persistent minimap widget. The fit-to-view button replaces the recurring
  need for one in this change's scope; a true minimap is its own change.
- Mobile floating Fit-to-view button (FAB). Sidebar entry covers the use case;
  a thumb-reach button is a follow-up.
- Animated zoom transitions. New cellSize/offset apply immediately, same as
  today.
- Changing pan behavior, devicePixelRatio handling, or any rendering of
  CellHighlight overlays. Highlight rendering uses the same
  `getCellColor` callback at any zoom level.
- Changing the persisted `useCanvasStore` shape. No migration is in scope.
- Lifting `MAX_CELL_SIZE`. Zoom-in stays at 50 px/cell.
