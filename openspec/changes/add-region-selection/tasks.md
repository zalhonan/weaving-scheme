# Tasks — add-region-selection

## 1. Types

- [ ] 1.1 Create `src/types/selection.ts` with `Tool`, `RefineMode`,
      `SelectionMask`, `MirrorAxis`, `GhostKind`, `GhostState`,
      `ClipboardEntry`. Run `npm run typecheck`.
- [ ] 1.2 Re-export new types from `src/types/index.ts`. Run
      `npm run typecheck`.

## 2. Store

- [ ] 2.1 Create `src/store/useSelectionStore.ts` with state shape
      (`tool`, `selection`, `refineMode`, `ghost`, `clipboard`,
      `axisPicker`) and basic setters (`setTool`, `setRefineMode`,
      `clearAll`). No persistence, no temporal middleware. Run
      `npm run typecheck`.
- [ ] 2.2 Implement selection-mask actions on `useSelectionStore`:
      `setSelection(mask, refineMode)`, `clearSelection`. Replace,
      add, and subtract semantics implemented inside `setSelection`.
      Run `npm run typecheck`.
- [ ] 2.3 Implement ghost lifecycle on `useSelectionStore`:
      `beginMoveGhost`, `beginPasteGhost`, `beginMirrorGhost(axis)`,
      `adjustGhost(dx, dy)` (with bbox clamping), `cancelGhost`. Run
      `npm run typecheck`.
- [ ] 2.4 Implement clipboard actions on `useSelectionStore`:
      `copySelection`, `cutSelection`, `pasteFromClipboard`. Cut goes
      through `useCanvasStore.applyDelete` for the undoable side.
      Run `npm run typecheck`.
- [ ] 2.5 Implement axis-picker actions: `beginAxisPicker`,
      `confirmAxis(axis)`, `cancelAxisPicker`. Run
      `npm run typecheck`.
- [ ] 2.6 Add `applyMove`, `applyDelete`, `applyPaste`, `applyMirror`
      actions to `useCanvasStore`. Each is a single `set(...)` call
      so zundo records one undo step. Reuse existing
      `addMultipleLines` / `removeMultipleLines` shapes for atomic
      mutation. Run `npm run typecheck`.
- [ ] 2.7 Wire `commitGhost` on `useSelectionStore` to call the
      appropriate `apply*` action and then clear the ghost. Run
      `npm run typecheck`.
- [ ] 2.8 Add canvas-resize coupling: in `useCanvasStore.resizeCanvas`
      and `setCanvasSize`, also call
      `useSelectionStore.getState().clearAll()`. Run
      `npm run typecheck`.
- [ ] 2.9 Re-export `useSelectionStore` from `src/store/index.ts`.
      Run `npm run typecheck`.

## 3. Utils

- [ ] 3.1 Create `src/utils/canvas/selection/maskUtils.ts`:
      `cellKey`, `parseCellKey`, `addCell`, `removeCell`, `hasCell`,
      `fromRect(x0, y0, x1, y1)`, `union(a, b)`, `subtract(a, b)`,
      `bbox(mask)`, `translate(mask, dx, dy)`. Tests in
      `__tests__/utils/maskUtils.test.ts`. Run `npm run test`.
- [ ] 3.2 Create `src/utils/canvas/selection/lasso.ts`:
      `appendPoint(points, newPoint, minDist=5)`,
      `pointInPolygon(point, polygon)` (ray-casting),
      `cellsInPolygon(polygon, width, height)`. Tests covering
      degenerate polygon, single-cell, ribbon shapes. Run
      `npm run test`.
- [ ] 3.3 Create `src/utils/canvas/selection/derivedLines.ts`:
      `getLinesInMask(mask, allLines)` with inclusive-boundary rule.
      Tests for: lines fully inside, lines on boundary, disjoint mask.
      Run `npm run test`.
- [ ] 3.4 Create `src/utils/canvas/selection/transforms.ts`:
      `translateLines(lines, dx, dy)`,
      `mirrorLines(lines, axis: MirrorAxis)`,
      `normalizeToOrigin(lines)`. Tests covering: translate clamping,
      mirror across vertical axis (horizontal lines `2a − x − 1`,
      vertical lines `2a − x`), mirror across horizontal axis
      (symmetric), orientation preservation. Run `npm run test`.
- [ ] 3.5 Create `src/utils/canvas/selection/marchingAnts.ts`:
      `traceBoundary(mask)` returns an array of polylines (segments
      forming the visible perimeter of the mask). Tests for: square
      mask, mask with hole, disjoint mask. Run `npm run test`.
- [ ] 3.6 Re-export new utilities from
      `src/utils/canvas/index.ts`. Run `npm run typecheck`.

## 4. Renderer / Overlay

- [ ] 4.1 Add a second `<canvas>` element in `Canvas.tsx`, absolutely
      positioned over the existing canvas with `pointer-events: none`
      and `z-index: 2`. Verify visually: open dev server, draw a
      line, confirm no regression in the static layer.
- [ ] 4.2 Create `src/components/Canvas/useOverlayRenderer.ts` with a
      RAF loop that starts when
      `selection !== null || ghost !== null || axisPicker?.active`
      and stops otherwise. Run `npm run typecheck`.
- [ ] 4.3 Implement marching-ants drawing inside the overlay
      renderer: trace boundary, draw dashed polyline, advance dash
      offset by 0.5 px/frame. Manual verify on dev server.
- [ ] 4.4 Implement ghost-line drawing on the overlay canvas at ~50 %
      opacity, 2 px stroke. Manual verify.
- [ ] 4.5 Implement axis-picker overlay: highlight the nearest grid
      line under the cursor in axis-picker mode. Manual verify.

## 5. Components — Sidebar

- [ ] 5.1 Add a tool switcher in `src/components/Sidebar/`: buttons
      for Draw / Rectangle Select / Lasso Select wired to
      `useSelectionStore.setTool`. Run `npm run typecheck`.
- [ ] 5.2 Add a selection-operations section that becomes visible
      when `selection !== null`: buttons for Move, Delete, Copy,
      Cut, Paste, Flip H, Flip V, Mirror. Run `npm run typecheck`.
- [ ] 5.3 Update `HotkeysInfo.tsx` with new shortcuts: `V` /
      `B` (tool switch), `Delete`, `Ctrl/Cmd + C/X/V`, `Enter`
      (confirm ghost), `Escape` (cancel ghost), arrow keys (nudge
      ghost). Run `npm run lint`.
- [ ] 5.4 Update `Sidebar/UndoRedo.tsx` to call
      `useSelectionStore.getState().clearAll()` after any undo or
      redo. Run `npm run typecheck`.

## 6. Components — Mobile

- [ ] 6.1 Add a tool toggle in `MobileToolbar.tsx` (Draw / Rect /
      Lasso). Run `npm run typecheck`.
- [ ] 6.2 Add a tri-state refinement toggle
      (`[Replace | Add | Subtract]`) visible only while a select
      tool is active. Wired to `useSelectionStore.setRefineMode`.
      Run `npm run typecheck`.
- [ ] 6.3 Add an operations sub-toolbar visible when
      `selection !== null`: Move, Delete, Copy, Cut, Paste, Flip H,
      Flip V, Mirror. Run `npm run typecheck`.
- [ ] 6.4 Add a ghost-control sub-toolbar visible when
      `ghost !== null`: arrow-nudge buttons (↑ ↓ ← →) and
      Confirm / Cancel. Run `npm run typecheck`.
- [ ] 6.5 Update `GestureHints.tsx` with new gesture vocabulary:
      single-finger drag in select tool = marquee, drag inside
      selection bbox = move, long-press disabled in select tool.
      Run `npm run lint`.

## 7. Components — Canvas interaction

- [ ] 7.1 In `useCanvasInteraction.ts`, branch at the top of
      `handleMouseDown` / `handleMouseMove` / `handleMouseUp` on
      `useSelectionStore.tool`. When `'draw'`: existing path
      unchanged. When `'select-rect'` or `'select-lasso'`: new
      paths. Run `npm run typecheck`.
- [ ] 7.2 Implement rectangle-marquee mouse path: track start cell,
      current cell, on mouse-up call
      `setSelection(maskUtils.fromRect(...), refineMode)`. Honor
      `Shift` (`add`) and `Ctrl`/`Cmd` (`subtract`) overrides over
      the toolbar refinement mode. Manual verify: draw rect, see
      marching ants.
- [ ] 7.3 Implement lasso mouse path: collect points via
      `lasso.appendPoint`, on mouse-up build mask via
      `lasso.cellsInPolygon` and call `setSelection`. Manual verify.
- [ ] 7.4 Implement ghost interaction in `useCanvasInteraction.ts`:
      drag inside selection bbox starts move-ghost; drag while
      ghost active calls `adjustGhost`. Manual verify.
- [ ] 7.5 Implement axis-picker interaction: when
      `axisPicker.active`, mouse-move only updates overlay (no
      drawing); click on a grid line within proximity threshold
      calls `confirmAxis`. Manual verify.
- [ ] 7.6 Implement keyboard shortcuts in `Canvas.tsx` (or a new
      `useCanvasShortcuts.ts`): `V` / `B` tool switch, `Delete` /
      `Backspace`, `Ctrl/Cmd + C/X/V`, `Enter` (commit ghost),
      `Escape` (cancel ghost / cancel axis-picker), arrow keys
      (nudge ghost; if no ghost, create move-ghost at offset 0,0
      and nudge). Run `npm run typecheck`. Manual verify.
- [ ] 7.7 Mirror the changes in `useCanvasTouchInteraction.ts`:
      branch on `tool` for single-finger paths, gate long-press =
      erase behind `tool === 'draw'`, route ghost commit/cancel
      through toolbar buttons (no auto-commit on lift). Run
      `npm run typecheck`. Manual verify on mobile preview.

## 8. Tests

- [ ] 8.1 Store tests for `useSelectionStore`: tool switch clears
      selection and ghost, refinement modes union/subtract correctly,
      `adjustGhost` clamps to canvas bounds. Run `npm run test`.
- [ ] 8.2 Integration test: full move flow — select → move →
      confirm → verify lines moved and original removed → undo →
      verify both selection cleared and lines restored. Run
      `npm run test`.
- [ ] 8.3 Integration test: copy / paste flow — select → copy →
      paste → adjust ghost → confirm → verify lines duplicated.
      Run `npm run test`.
- [ ] 8.4 Integration test: mirror flow with custom axis — select →
      mirror → confirm axis on a column boundary → confirm ghost →
      verify reflected lines and original removed. Run
      `npm run test`.
- [ ] 8.5 Edge-case test: `CellHighlight` rows/columns remain in
      place after move and after delete operate on a covering
      selection. Run `npm run test`.
- [ ] 8.6 Edge-case test: cut clears selection; pasting after cut
      lands clipboard content; undoing cut restores lines (clipboard
      retains content — duplicate behavior is intentional). Run
      `npm run test`.
- [ ] 8.7 Edge-case test: canvas resize while selection active
      clears selection. Run `npm run test`.

## 9. Docs

- [ ] 9.1 Update `documentation/user-stories.md` with new user
      stories for the selection capability (one per requirement,
      acceptance criteria mirror spec.md scenarios). Manual review.
- [ ] 9.2 Update `documentation/epics.md` to register the new
      selection epic (or extend an existing one). Manual review.

## 10. Validate

- [ ] 10.1 Run `npm run typecheck && npm run lint && npm run test`
      and resolve all errors.
- [ ] 10.2 Run `openspec validate add-region-selection --strict` and
      resolve every error before this change can be archived.
