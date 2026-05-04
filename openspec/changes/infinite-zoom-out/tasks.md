# Tasks — infinite-zoom-out

## 1. Types

- [x] 1.1 In `src/types/viewport.ts`, change `MIN_CELL_SIZE: 8` to
      `MIN_CELL_SIZE: 0.5`. Keep `MAX_CELL_SIZE: 50` and
      `DEFAULT_CELL_SIZE: 25` unchanged. Run `npm run typecheck`.
- [x] 1.2 In `src/constants/canvas.ts`, replace the literal cell-size limits
      with re-exports from `VIEWPORT_LIMITS`:
      `MIN_CELL_SIZE: VIEWPORT_LIMITS.MIN_CELL_SIZE` (and the same for MAX
      and DEFAULT). Keep all other constants. Run `npm run typecheck`.
- [x] 1.3 Audit: `grep -n "MIN_CELL_SIZE\|MAX_CELL_SIZE\|DEFAULT_CELL_SIZE"
      src/` — confirm there is now exactly one literal-number declaration
      per constant (in `viewport.ts`). Manual.

## 2. Store

- [x] 2.1 Change `useViewportStore.zoom()` signature in
      `src/store/useViewportStore.ts` from
      `(delta: number, cursorX: number, cursorY: number)` to
      `(factor: number, cursorX: number, cursorY: number)`. Implementation:
      `newCellSize = clamp(cellSize * factor, MIN, MAX)`. Cursor-anchor math
      (`scale = newCellSize / cellSize`, offset update) unchanged. Run
      `npm run typecheck`.
- [x] 2.2 Add `fitToView(viewportWidth: number, viewportHeight: number)`
      action on `useViewportStore`. Reads `width`/`height` from
      `useCanvasStore.getState()`. Computes target `cellSize` clamped to
      `[MIN_CELL_SIZE, DEFAULT_CELL_SIZE]` and centers the grid in the
      viewport (offset math per design.md §4). Run `npm run typecheck`.
- [x] 2.3 Verify `useViewportStore` is still session-only — no `persist`
      middleware introduced, `partialize` not added, no localStorage key.
      Manual code review confirms: no persist import, no partialize, no
      localStorage write paths. Test file deferred to task 6.5 where the
      full assertion set is created in one pass.

## 3. Utils — Renderer

- [x] 3.1 In `src/utils/canvas/renderer.ts`, introduce a
      `RenderProfile` helper at the top of `renderCanvas` that derives
      from `cellSize` the booleans:
      `showNumbers` (≥ 8), `showTails` (≥ 4), `showMinorGrid` (≥ 2.5),
      `showMajorGrid` (≥ 1.5), `userLineMode: 'stroke' | 'fillRect'`
      (`stroke` if ≥ 1.5 else `fillRect`). Thresholds as named constants
      at top of file.
- [x] 3.2 Compute `visibleMinX/MaxX/MinY/MaxY` at the top of
      `renderCanvas` from `offsetX`, `offsetY`, `cellSize`, the canvas
      `clientWidth/clientHeight`, and `NUMBER_AREA_WIDTH`. Pad ±1 cell
      on each edge to absorb fractional-offset boundary cases.
- [x] 3.3 Replace the cell-highlight loop with bounded ranges.
- [x] 3.4 Replace the minor-grid-line loops with bounded ranges. Gate
      execution on `profile.showMinorGrid`.
- [x] 3.5 Replace the major-grid-line loops with bounded ranges, rounding
      the start *down* to the previous multiple of `MAJOR_GRID_INTERVAL`.
      Gate on `profile.showMajorGrid`.
- [x] 3.6 Gate the tail-drawing loop on `profile.showTails`. Use bounded
      ranges.
- [x] 3.7 Gate the column- and row-number `fillText` loops on
      `profile.showNumbers`. Use bounded ranges.
- [x] 3.8 In the user-line `lines.forEach`, add a visible-bbox filter
      (skip lines outside the visible cell range with ±1 padding).
      Branch on `profile.userLineMode`: `stroke` keeps the existing
      code path; `fillRect` draws a `max(1, cellSize) × max(1, cellSize)`
      rectangle on the cell edge per design.md §3.

## 4. Components — Canvas interaction

- [x] 4.1 Update `useCanvasInteraction.ts:handleWheel` to pass a
      multiplicative factor instead of additive delta:
      `const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;`
      where `ZOOM_FACTOR = 1.08`.
- [x] 4.2 Update `useCanvasTouchInteraction.ts` pinch handler to feed
      `currentDistance / initialDistance` directly into `zoom()` as the
      factor; update `initialDistance` on each frame. Drop the
      `(scale - 1) * 10` translation. Dead-zone `|scale-1| > 0.01` to
      suppress finger jitter.
- [x] 4.3 Add a `0` keyboard shortcut in `useCanvasShortcuts.ts` (only when
      no modifier and no input-element focused) that reads canvas client
      dims via a passed-in `canvasRef` and calls
      `useViewportStore.fitToView(...)`.

## 5. Components — Sidebar

- [x] 5.1 Create `src/components/Sidebar/ViewControl.tsx` exporting a
      single button "Вписать в экран" that, on click, measures the
      canvas element via `document.querySelector('canvas')` and calls
      `fitToView(...)`.
- [x] 5.2 Re-export `ViewControl` from `src/components/Sidebar/index.ts`.
      Insert `<ViewControl />` into `Sidebar.tsx` above `<UndoRedo />`.
- [x] 5.3 Add the `0` shortcut entry to `HotkeysInfo.tsx`.

## 6. Tests — regression (must pass UNCHANGED tests + new pin-down tests)

- [x] 6.1 Run `npm run test` — confirm all existing tests pass. Zero
      changes to existing test files allowed in this task. Result: 93/93
      pre-existing tests pass.
- [x] 6.2 Renderer regression at cellSize ∈ {8, 12, 25, 50}: structural
      assertion (numbers fire, strokes fire, no fillRect for user lines
      because stroke mode is active). File:
      `__tests__/utils/canvas/renderer.test.ts`.
- [x] 6.3 Cursor-anchor regression: 3 tests in
      `__tests__/store/useViewportStore.test.ts` covering zoom-in,
      zoom-out, and round-trip — all preserve the screen-relative
      anchor invariant. (Test asserts the actual math invariant, which
      is screen-relative; a grid-relative invariant was inappropriate
      because the pre-change code anchors in raw canvas coords.)
- [x] 6.4 localStorage-shape regression: hand-crafted snapshot loaded
      via `persist.rehydrate()`, all fields verified — file:
      `__tests__/store/useCanvasStore.persistence.test.ts`. Also
      verifies viewport store does not write to localStorage.
- [x] 6.5 `__tests__/store/useViewportStore.test.ts` — 14 tests covering
      multiplicative zoom math, clamps, anchor invariant, fitToView
      cases (1000×1000, 5×5, 100×100, centering), reset, session-only
      persistence.

## 7. Tests — new behavior

- [x] 7.1 Renderer adaptive-threshold tests added in
      `__tests__/utils/canvas/renderer.test.ts`: cellSize 7.5 hides
      numbers, 3.5 hides tails, 1.4 hides both grids, 1.6 keeps major
      grid only, 1 renders user lines as fillRect.
- [x] 7.2 Viewport-culling test: 1000×1000 grid at cellSize=2 in
      800×600 viewport produces fewer than 200 000 fillRect calls
      (vs. 1 000 000 without culling). Plus a fractional-offset
      no-clipping test.

## 8. Docs

- [x] 8.1 Updated `documentation/user-stories.md` US-2.1 with new
      limits (0.5–50), multiplicative-step note, and adaptive-rendering
      thresholds.
- [x] 8.2 Updated `documentation/user-stories.md` US-6.4 (pinch-zoom)
      to share the same multiplicative contract and 0.5–50 limits.
- [x] 8.3 Added US-2.6 (not US-2.4 — that slot was taken by Undo/Redo)
      «Вписать канву в экран» with full acceptance criteria. Updated
      the summary table accordingly.
- [x] 8.4 Updated `documentation/epics.md` Эпик 2: new zoom limits,
      adaptive-rendering note, fit-to-view button.
- [x] 8.5 Updated `documentation/architecture.md` Performance
      Considerations with viewport-culling, adaptive-profile, and
      multiplicative-zoom paragraphs.

## 9. Validate

- [x] 9.1 `npm run typecheck && npm run lint && npm run test` — all
      green. 123 tests pass (93 pre-existing + 30 new). No skipped tests.
- [ ] 9.2 Manual smoke check (UI verification list — single pass on the
      dev server):
      - [ ] Wheel zoom in/out at default zoom feels the same as today.
      - [ ] Cursor-anchor: zoom over a specific cell, that cell stays
            under the cursor.
      - [ ] At 1000×1000, fit-to-view button shows the whole canvas
            centered with breathing room.
      - [ ] At cellSize=1, user lines render as filled rectangles, not
            smeared strokes.
      - [ ] At cellSize=2, minor grid is hidden, major grid every 10
            still visible.
      - [ ] Numbers and tails disappear cleanly below their thresholds.
      - [ ] Drawing/erasing/select/move/mirror/rotate/copy/paste at
            cellSize ≥ 8 work exactly as before.
      - [ ] Touch pinch-zoom on a real phone or browser emulation: same
            limits, same anchor behavior.
      - [ ] `0` hotkey fits the canvas. Refresh — viewport state resets
            to default (session-only confirmed).
      - [ ] Reload with an existing scheme in localStorage — scheme
            loads identically (no migration triggered).
- [x] 9.3 `openspec validate infinite-zoom-out --strict` — passes.
