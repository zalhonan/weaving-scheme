# Tasks — add-region-selection

## 0. Tooling Setup (prerequisite, not part of the `selection` capability spec)

- [x] 0.1 Create `eslint.config.js` (ESLint 9 flat config) using
      already-installed `@eslint/js`, `typescript-eslint`,
      `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`,
      `globals`. Honor `_`-prefix unused-vars convention. Run
      `npm run lint`.
- [x] 0.2 Switch `package.json` test script to `vitest run --passWithNoTests`
      so the regimen does not hang in watch mode; add `test:watch` for
      interactive use. Run `npm run test`.
- [x] 0.3 Resolve pre-existing lint findings in untouched code so the
      regimen has a green baseline (eslint-disable for the intentional
      `highlights` dep in `useCanvasRenderer.ts`; `_`-prefix already
      handled by config).

## 1. Types

- [x] 1.1 Create `src/types/selection.ts` with `Tool`, `RefineMode`,
      `SelectionMask`, `MirrorAxis`, `GhostKind`, `GhostState`,
      `ClipboardEntry`. Run `npm run typecheck`.
- [x] 1.2 Re-export new types from `src/types/index.ts`. Run
      `npm run typecheck`.
- [x] 1.3 Extend `GhostKind` with `'rotate'`; add
      `RotationDirection = 'cw' | 'ccw'`. Run `npm run typecheck`.

## 2. Store

- [x] 2.1 Create `src/store/useSelectionStore.ts` with state shape
      (`tool`, `selection`, `refineMode`, `ghost`, `clipboard`,
      `axisPicker`) and basic setters (`setTool`, `setRefineMode`,
      `clearAll`). No persistence, no temporal middleware. Run
      `npm run typecheck`.
- [x] 2.2 Implement selection-mask actions on `useSelectionStore`:
      `setSelection(mask, refineMode)`, `clearSelection`. Replace,
      add, and subtract semantics implemented inside `setSelection`.
      Run `npm run typecheck`.
- [x] 2.3 Implement ghost lifecycle on `useSelectionStore`:
      `beginMoveGhost`, `beginPasteGhost`, `beginMirrorGhost(axis)`,
      `adjustGhost(dx, dy)` (with bbox clamping), `cancelGhost`. Run
      `npm run typecheck`.
- [x] 2.4 Implement clipboard actions on `useSelectionStore`:
      `copySelection`, `cutSelection`, `pasteFromClipboard`. Cut goes
      through `useCanvasStore.applyDelete` for the undoable side.
      Run `npm run typecheck`.
- [x] 2.5 Implement axis-picker actions: `beginAxisPicker`,
      `confirmAxis(axis)`, `cancelAxisPicker`. Run
      `npm run typecheck`.
- [x] 2.6 Add `applyMove`, `applyDelete`, `applyPaste`, `applyMirror`
      actions to `useCanvasStore`. Each is a single `set(...)` call
      so zundo records one undo step. Reuse existing
      `addMultipleLines` / `removeMultipleLines` shapes for atomic
      mutation. Run `npm run typecheck`.
- [x] 2.7 Wire `commitGhost` on `useSelectionStore` to call the
      appropriate `apply*` action and then clear the ghost. Run
      `npm run typecheck`.
- [x] 2.8 Add canvas-resize coupling. **Implemented as one-way
      subscribe inside `useSelectionStore`** (cleaner than the original
      "modify `useCanvasStore.resizeCanvas`" plan, which would create a
      circular import). Canvas store stays unaware of selection.
      Run `npm run typecheck`.
- [x] 2.9 Re-export `useSelectionStore` from `src/store/index.ts`.
      Run `npm run typecheck`.
- [x] 2.10 (superseded — see 2.12) Initial impl added `applyRotate` and
      kept `applyMirror`. After the composable-transforms refactor those
      are removed; only `applyMove` / `applyDelete` / `applyPaste` remain
      in `useCanvasStore` actions for selection-driven transforms.
- [x] 2.11 (superseded — see 2.12) `beginMirrorGhost` /
      `beginRotateGhost` are gone. Mirror and rotate are now transforms
      that compose onto an active ghost.
- [x] 2.12 Composable-transforms refactor. Selection store exposes
      `applyFlipHorizontal`, `applyFlipVertical`,
      `applyMirrorAcrossAxis(axis)`, `applyRotate(direction)`. Each
      lazily creates a ghost from the selection (move-kind) if none
      exists, then transforms `ghost.lines` and `ghost.destMask` in
      place. `commitGhost` simplifies to two cases (paste → applyPaste;
      anything else → applyMove). `GhostKind` shrinks to `'move'`/`'paste'`.
      `confirmAxis` calls `applyMirrorAcrossAxis`. UI keeps Flip/Mirror/
      Rotate buttons visible during ghost.

## 3. Utils

- [x] 3.1 Create `src/utils/canvas/selection/maskUtils.ts`:
      `cellKey`, `parseCellKey`, `addCell`, `removeCell`, `hasCell`,
      `fromRect(x0, y0, x1, y1)`, `union(a, b)`, `subtract(a, b)`,
      `bbox(mask)`, `translate(mask, dx, dy)`, `mirrorMask(mask, axis)`.
      Tests in `__tests__/utils/canvas/selection/maskUtils.test.ts`.
      Run `npm run test`.
- [x] 3.2 Create `src/utils/canvas/selection/lasso.ts`:
      `appendPoint(points, newPoint, minDist=5)`,
      `pointInPolygon(point, polygon)` (ray-casting),
      `cellsInPolygon(polygon, width, height)`. Tests covering
      degenerate polygon, single-cell, ribbon shapes. Run
      `npm run test`.
- [x] 3.3 Create `src/utils/canvas/selection/derivedLines.ts`:
      `getLinesInMask(mask, allLines)` with inclusive-boundary rule.
      Tests for: lines fully inside, lines on boundary, disjoint mask.
      Run `npm run test`.
- [x] 3.4 Create `src/utils/canvas/selection/transforms.ts`:
      `translateLines(lines, dx, dy)`,
      `mirrorLines(lines, axis: MirrorAxis)`,
      `normalizeToOrigin(lines)`, `linesBbox(lines)`. Tests covering:
      translate, mirror across vertical axis (horizontal lines
      `2a − x − 1`, vertical lines `2a − x`), mirror across horizontal
      axis (symmetric), orientation preservation. Run `npm run test`.
- [x] 3.5 Create `src/utils/canvas/selection/marchingAnts.ts`:
      `traceBoundary(mask)` returns an array of unit-length grid
      edges between in-cells and out-cells. Tests for: square mask,
      mask with hole, disjoint mask. Run `npm run test`.
- [x] 3.6 Re-export new utilities from
      `src/utils/canvas/index.ts`. Run `npm run typecheck`.
- [x] 3.7 Add `rotateLines(lines, direction, cx, cy)` to
      `src/utils/canvas/selection/transforms.ts`. Swaps line
      orientation; rounds to nearest integer cell coord for
      non-square bboxes. Tests cover: orientation flip (h ↔ v),
      4 CW = identity for square bbox, CCW = inverse of CW, color
      preservation, non-square rounding to integer.
- [x] 3.8 Add `rotateMask(mask, direction, cx, cy)` to
      `src/utils/canvas/selection/maskUtils.ts`. Same math as
      `rotateLines` for cells. Tests cover: 2x2 corner rotation,
      4 CW identity, CCW inverse, non-square dimension swap (4×2 →
      2×4) with integer-only result, 3×3 with half-integer center.

## 4. Renderer / Overlay

- [x] 4.1 Add a second `<canvas>` element in `Canvas.tsx`, absolutely
      positioned over the existing canvas with `pointer-events: none`.
      Both canvases wrapped in a `.container` div. (Slice A)
- [x] 4.2 Create `src/components/Canvas/useOverlayRenderer.ts` with a
      RAF loop that starts when
      `selection || ghost || axisPicker || marqueePreview` is non-null
      and stops otherwise. Subscribes to viewport store for redraws on
      pan/zoom even when RAF is idle. (Slice A)
- [x] 4.3 Implement marching-ants drawing inside
      `src/utils/canvas/overlayRenderer.ts`: trace boundary, draw
      dashed polyline (white underlay + black overlay with half-cycle
      offset for legibility), advance dash offset by 0.5 px/frame.
      Also draws live marquee preview rect. (Slice A)
- [x] 4.4 Implement ghost-line drawing on the overlay canvas at ~50 %
      opacity, 2 px stroke, per-line color preserved. (Slice B)
- [x] 4.5 Implement axis-picker overlay: a dashed orange line crossing
      the canvas at the candidate axis (horizontal or vertical grid line
      nearest the cursor). Animated via the same dashOffset as ants.
      (Slice E)

## 5. Components — Sidebar

- [x] 5.1 Add a tool switcher in `src/components/Sidebar/SelectionTool.tsx`:
      buttons for Draw / Rectangle / Lasso wired to
      `useSelectionStore.setTool`. Lasso button is functional only after
      slice C — clicking it switches the mode but selection-lasso input
      is not yet wired. (Slice A)
- [x] 5.2 (slices B+D+E) `SelectionOps` is visible when
      `selection || ghost || clipboard || axisPicker` exists.
      Slice B: Move/Delete (when selection), Confirm/Cancel (when ghost).
      Slice D: Копия/Вырезать (when selection), Вставить (when clipboard).
      Slice E: Flip H, Flip V, По оси (when selection); axis-picker mode
      shows instruction + Cancel.
- [x] 5.5 Add Rotate CW (`↻ 90°`) and Rotate CCW (`↺ 90°`) buttons
      to `SelectionOps`, visible when a selection exists and no
      ghost is active. Each button calls
      `useSelectionStore.beginRotateGhost(direction)`.
- [x] 5.3 Hotkeys updated incrementally across slices A–G:
      `Esc` (slice A), `Enter` / `Del` / arrows (slice B),
      `Ctrl/⌘ + Z / Shift+Z / Y` (post-B fix), `Ctrl/⌘ + C / X / V`
      (slice D), `B` / `V` / `L` tool switch (slice G). All listed
      in `HotkeysInfo.tsx`. Implementation in `useCanvasShortcuts.ts`.
- [x] 5.4 Update `Sidebar/UndoRedo.tsx` to call
      `useSelectionStore.getState().clearAll()` after any undo or
      redo. Same coupling added to keyboard `Ctrl/Cmd+Z` /
      `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` shortcuts in
      `useCanvasShortcuts.ts`. `HotkeysInfo` updated to list these
      shortcuts.

## 6. Components — Mobile

- [ ] 6.1 (deferred) Tool toggle in floating `MobileToolbar`. Not
      strictly necessary — sidebar `SelectionTool` already provides it
      and is reachable via the ☰ button on mobile. Could promote in a
      follow-up.
- [x] 6.2 Tri-state refinement toggle
      (`[Заменить | + Добавить | − Убрать]`) added to `SelectionTool`
      — visible whenever a select tool is active. Works for desktop
      too (alternative to Shift/Ctrl).
- [ ] 6.3 (deferred) Operations sub-toolbar in floating
      `MobileToolbar`. Sidebar `SelectionOps` covers all ops; mobile
      user opens ☰ to access. Promote to floating in a follow-up.
- [x] 6.4 Floating `GhostActionBar` (mobile-only via `pointer: coarse`
      / `<= 768px`) with Confirm / Cancel — within thumb reach so the
      user doesn't have to open the sidebar after each touch ghost.
      In axis-picker mode shows hint + Cancel. Arrow-nudge buttons
      deferred (drag works fine on touch).
- [x] 6.5 Update `GestureHints.tsx` with selection-mode gestures.

## 7. Components — Canvas interaction

- [x] 7.1 In `useCanvasInteraction.ts`, branch at the top of
      `handleMouseDown` on `useSelectionStore.tool`. When `'draw'`:
      existing path unchanged. When `'select-rect'`: marquee path.
      When `'select-lasso'`: no-op until slice C. (Slice A)
- [x] 7.2 Implement rectangle-marquee mouse path: track anchor cell
      via `marqueeAnchor` ref; mouse-move updates
      `setMarqueePreview` (live dashed rect on overlay); mouse-up
      calls `setSelection(fromRect(...), overrideMode)`. Mouse-leave
      commits via the same path. (Slice A; modifier override added
      in slice C — see 7.3.)
- [x] 7.3 Implement lasso mouse path + Shift/Ctrl modifier override.
      Lasso collects points in fractional grid coords with
      `appendPoint(minDist = 5/cellSize)`; live preview is a dashed
      polyline on the overlay; mouse-up builds mask via
      `cellsInPolygon` and calls `setSelection(mask, overrideMode)`.
      Modifier captured at mouseDown: Shift → `'add'`, Ctrl/Cmd →
      `'subtract'`, else null (toolbar mode wins). Same override
      applies to rect path. (Slice C)
- [x] 7.4 Implement ghost interaction in `useCanvasInteraction.ts`:
      drag inside selection bbox starts move-ghost; drag inside ghost
      bbox calls `adjustGhost` with incremental cell deltas; click
      outside ghost bbox commits. (Slice B)
- [x] 7.5 Implement axis-picker interaction: when `axisPicker.active`,
      mouse-move calls `setAxisCandidate(nearestAxis(...))` (always
      picks the nearest horizontal or vertical grid line); click calls
      `confirmAxis(nearestAxis(...))`. (Slice E)
- [x] 7.6 (partial — slices A+B+D) `useCanvasShortcuts.ts` handles:
      `Escape`, `Enter`, `Delete`/`Backspace`, arrow keys (with
      auto-create move-ghost from selection), `Ctrl/Cmd+Z` /
      `Ctrl/Cmd+Shift+Z` / `Ctrl/Cmd+Y` (undo/redo with selection
      clear), `Ctrl/Cmd+C` / `Ctrl/Cmd+X` / `Ctrl/Cmd+V` (clipboard).
      Tool-switch hotkeys (V/B/L) arrive in slice C.
- [x] 7.7 `useCanvasTouchInteraction.ts` branches on tool at the top
      of `handleTouchStart`. Selection-mode single-finger drag handles
      marquee (rect), lasso, ghost-drag, and axis-picker confirm.
      Long-press → erase is bypassed when a select tool is active
      (the select branch returns before the long-press timer is set
      up). `handleTouchEnd` commits marquee/lasso on lift; ghost is
      NEVER auto-committed on lift — explicit Confirm tap required
      via the floating `GhostActionBar`.

## 8. Tests

- [x] 8.1–8.7 Integration tests for `useSelectionStore` in
      `__tests__/store/useSelectionStore.test.ts`. 20 tests covering:
      tool-switch clears selection / ghost; refinement modes
      replace / add / subtract (incl. subtract-to-empty → null);
      move flow (begin → adjust → commit = 1 zundo entry; cancel = 0);
      composable transforms (flip + rotate + adjust = 1 zundo entry;
      lazy ghost creation from selection); copy / cut / paste (paste
      origin uses selection bbox; cut clears selection; clipboard
      preserved across off-canvas commit); CellHighlights unaffected
      by move; canvas resize clears selection; off-canvas clip on
      commit drops out-of-bounds lines; rotation 4×CW = identity.
      Vitest setup file (`__tests__/setup.ts`) stubs `localStorage`
      so `persist` middleware doesn't warn in node env.

## 9. Docs

- [x] 9.1 `documentation/user-stories.md` extended with Эпик 7
      (US-7.1 — US-7.15) covering all selection requirements, plus
      summary table entries.
- [x] 9.2 `documentation/epics.md` extended with «Эпик 7:
      Выделение и трансформации участков» — функционал, архитектура,
      ценность; the dependency graph updated.

## 10. Validate

- [x] 10.1 `npm run typecheck && npm run lint && npm run test` —
      all green. 93 tests pass.
- [x] 10.2 `openspec validate add-region-selection --strict` — valid.
