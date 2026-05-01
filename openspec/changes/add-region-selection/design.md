# Design — add-region-selection

## Goals

Introduce region selection plus four operation classes (move, delete,
copy/cut/paste, mirror) without disturbing the existing draw-mode pipeline.
Architect the floating-ghost mechanic and overlay canvas so they generalize
across all transforms — adding a future op (e.g. rotate, scale) requires only
new pure transform utilities, not new ghost plumbing.

## Tool mode

The canvas currently has no tool concept — pointer input always means "draw".
Adding selection requires explicit mode switching, otherwise modifier-key
meanings (`Shift+click` = extend line, `Ctrl+click` = flood fill) collide with
selection refinement.

```ts
type Tool = 'draw' | 'select-rect' | 'select-lasso';
```

`useSelectionStore.tool` is the single source of truth. `useCanvasInteraction`
and `useCanvasTouchInteraction` branch on it at the top of each handler.
Existing draw handlers remain unchanged when `tool === 'draw'`.

Switching tools cancels any in-progress drag, clears the active selection, and
clears any ghost. This is intentional — switching tools mid-operation is an
explicit cancel.

## Selection state

A new session-only store `useSelectionStore`. Not persisted. Not undoable.

```ts
interface SelectionState {
  tool: Tool;
  selection: SelectionMask | null;
  refineMode: 'replace' | 'add' | 'subtract';
  ghost: GhostState | null;
  clipboard: ClipboardEntry | null;
  axisPicker: { active: boolean } | null;
}

type SelectionMask = Set<string>;          // `${cellX}-${cellY}` keys

interface GhostState {
  kind: 'move' | 'paste' | 'mirror';
  lines: Line[];                           // already transformed, ready to commit
  sourceMask: SelectionMask | null;        // for move/mirror: cells to clear on commit
}

interface ClipboardEntry {
  lines: Line[];                           // normalized to (0,0) origin
  bbox: { width: number; height: number };
}
```

### Why a new store

- Coherent slice with multiple related fields (selection, ghost, clipboard,
  refineMode, axisPicker, tool).
- `useUIStore` is for UI chrome (sidebar, toasts, mobile toolbar). Mixing in
  selection bloats it.
- `useCanvasStore` is undoable; selection itself must NOT participate in
  temporal history.
- A dedicated module is the natural place to subscribe to canvas-store
  temporal events for the "clear-on-undo/redo" coupling.

## Hybrid model — derived lines (inclusive boundary)

The user's selection unit is a cell set, but the operands of move / copy /
mirror / delete are lines, which live on cell borders.

**Inclusive boundary rule:** a horizontal line at `(x, y)` belongs to the
selection iff cell `(x, y-1) ∈ mask` OR cell `(x, y) ∈ mask` (either side
touches). A vertical line at `(x, y)` belongs iff `(x-1, y) ∈ mask` OR
`(x, y) ∈ mask`.

This is implemented in `getLinesInMask(mask, allLines)` — pure function,
unit-tested independently from store / UI.

```
Example: selection = {(1,1), (2,1)}  (two cells in row 1)

      x=0   x=1   x=2   x=3
y=0    ─    ─     ─           ← y=0 line above (1,0): NOT in mask
                              ← horizontal lines at y=1: BOTH
              ┌─────┬─────┐      sides — top of selection
y=1    │      │  X  │  X  │ │     → IN selection
              ├─────┼─────┤
y=2           ──────┴──────   ← y=2 line below (1,1): bottom edge
                                of selection → IN selection
```

## Floating ghost — universal mechanic for transforms

Every transform that produces "moved/changed lines elsewhere on canvas" goes
through the same ghost lifecycle:

```
                  ┌─────────────────┐
  begin*Ghost  ──▶│  ghost active:  │
                  │    lines        │
                  │    sourceMask?  │
                  └────────┬────────┘
                           │
              adjust(dx,dy)│  (drag, arrow keys, axis change)
                           ▼
                 ┌───────────────────┐
                 │  ghost still       │
                 │  active, updated   │
                 └────────┬──────────┘
                          │
        ┌─────────────────┼──────────────────┐
        │                                     │
    commitGhost()                       cancelGhost()
        │                                     │
        ▼                                     ▼
   single undoable                       discard ghost,
   apply* action on                      restore selection
   useCanvasStore                        to pre-op state
```

`adjustGhost(dx, dy)` translates `ghost.lines` by `(dx, dy)` cells. No
separately-stored transform — every adjust mutates `lines` directly. Cost is
O(n) per adjust where n is ghost line count (typically <200), trivial.

`commitGhost()` calls one of `applyMove` / `applyPaste` / `applyMirror` on
`useCanvasStore`, each a single `set(...)` call so zundo records exactly one
undo step. After commit the selection mask follows the operation:

- After move: selection is the destination cell set (translated).
- After paste: selection is the pasted cell set.
- After mirror: selection is the mirrored cell set.

This lets the user chain operations naturally.

### Visual treatment

- Ghost lines are drawn on the **overlay** canvas at ~50% opacity with a 2 px
  stroke (vs 1.5 px for committed lines).
- Original lines remain on the **static** canvas during move and mirror, so
  the user sees source AND destination simultaneously.
- For paste there is no original — only the ghost on overlay.

### Out-of-bounds clamping

`adjustGhost` clamps so that after translation every ghost line still lies
within `[0, width]` × `[0, height]`. Attempting to push past the edge is a
no-op. (Resizing the canvas to fit pasted content is out of scope.)

## Overlay canvas

Marching ants run at ~60 fps. Redrawing the entire static pattern at 60 fps
would be wasteful, so we add a second stacked `<canvas>`:

```
┌─────────────────────────────────┐
│ <canvas id="static" />          │  z-index: 1
│   - grid                        │  redraws on store change only (today's pipeline)
│   - lines                       │
│   - cell highlights             │
│   - row/col headers             │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│ <canvas id="overlay" />         │  z-index: 2; pointer-events: none
│   - marching ants (animated)    │  RAF loop, active iff:
│   - ghost lines                 │     selection !== null ||
│   - axis-picker hover           │     ghost !== null ||
│                                 │     axisPicker?.active
└─────────────────────────────────┘
```

`pointer-events: none` on overlay means all input still reaches the static
canvas — no event re-routing needed.

`useOverlayRenderer` hook:

- Starts a `requestAnimationFrame` loop when overlay content exists.
- Each frame: `clearRect` overlay, draw ghost lines, draw selection boundary
  as dashed polyline with current dash offset, draw axis-picker preview.
- Dash offset advances by 0.5 px / frame.
- Cancels the loop when overlay content becomes empty.

## Lasso

Free polygon collected during a single drag. Smoothing rule: a new point is
appended only if its screen distance from the last accepted point is ≥ 5 px.
This kills jitter without significant fidelity loss for cell-resolution
selection. (Decision noted during exploration; alternatives like
Douglas–Peucker post-process are heavier and unnecessary.)

On release, point-in-polygon (cell center) test produces the cell mask via
the standard ray-casting algorithm.

Edge case: release before moving (single click) → empty point list →
`setSelection` is a no-op.

## Mirror with axis picker

Axes are restricted to grid lines (same coordinate system as `Line`):

- Horizontal axis: any row boundary `y ∈ [0..height]`.
- Vertical axis: any column boundary `x ∈ [0..width]`.

UX flow:

1. User invokes "Mirror" → `axisPicker.active = true`, cursor → crosshair.
2. Pointer move: overlay highlights the nearest grid line within proximity
   threshold.
3. Click: axis is set, mirror ghost is computed, `axisPicker` exits, ghost
   becomes adjustable like any other ghost.

### Mirror math

Reflection does NOT change line orientation (it is a flip, not a rotation).

Recall line semantics:

- Horizontal line `(x, y)`: x = column index (`0..width-1`),
  y = row boundary (`0..height`). Spans `[x, x+1]` along boundary y.
- Vertical line `(x, y)`: x = column boundary (`0..width`),
  y = row index (`0..height-1`). Spans `[y, y+1]` along boundary x.

**Mirror across vertical axis `x = a`** (a is a column boundary):

- Horizontal `(x, y)` spans `[x, x+1]`. Reflected span: `[2a − x − 1, 2a − x]`.
  → new x = `2a − x − 1`. Same y. Same orientation.
- Vertical `(x, y)` is at column boundary x. Reflected: column boundary
  `2a − x`. → new x = `2a − x`. Same y. Same orientation.

**Mirror across horizontal axis `y = b`** (b is a row boundary):

- Horizontal `(x, y)` is on row boundary y. Reflected: boundary `2b − y`.
  → new y = `2b − y`. Same x. Same orientation.
- Vertical `(x, y)` spans `[y, y+1]`. Reflected: `[2b − y − 1, 2b − y]`.
  → new y = `2b − y − 1`. Same x. Same orientation.

### Quick-preset axes (Flip H, Flip V)

Computed from selection bbox:

- Flip H around bbox vertical center: vertical axis at
  `bbox.minX + bbox.width / 2`.
- Flip V around bbox horizontal center: horizontal axis at
  `bbox.minY + bbox.height / 2`.

Bbox center may be a half-integer when bbox dimension is odd, which is fine —
the formulas above work for non-integer axes.

## Modifier semantics — resolved by tool dispatch

| Tool                         | `Shift+click/drag`        | `Ctrl/Cmd+click/drag`     |
|------------------------------|---------------------------|---------------------------|
| `draw`                       | extend line (US-3.1)      | flood fill (US-3.2)       |
| `select-rect`, `select-lasso`| add to selection          | subtract from selection   |

The same physical key combos produce different behavior based on `tool`.
Documented in `HotkeysInfo`.

## Touch model

Touch has no `Shift`/`Ctrl`. We add a tri-state toggle in `MobileToolbar`:

```
┌──────────────────────────────────────────┐
│ [ Replace ] | [ Add (+) ] | [ Subtract (−) ] │
└──────────────────────────────────────────┘
```

Visible only while a select tool is active. Determines refinement mode for
the next drag.

Operations are toolbar buttons (no keyboard shortcuts on touch). When ghost
is active, the toolbar shows additional controls:

```
            ┌────┐
            │ ↑  │
       ┌────┼────┼────┐
       │ ←  │    │ →  │
       └────┼────┼────┘
            │ ↓  │
            └────┘
       [ ✓ Confirm ]   [ ✗ Cancel ]
```

`GestureHints` is updated with new gesture vocabulary for select mode.

**Ghost commit on touch is never implicit.** Lifting the finger does not
commit. The user must tap **Confirm**. This is intentional — on touch,
accidental "click outside" is too easy.

Long-press currently means "erase" in the draw tool. While `tool` is a select
tool, `useCanvasTouchInteraction` does NOT route long-press to erase. (One
guarded branch.)

## Undo / redo coupling

`useCanvasStore` uses `zundo`'s `temporal` middleware. The
`Sidebar/UndoRedo.tsx` component invokes
`useCanvasStore.temporal.getState().undo()` and `redo()`. We extend those
call sites — the cleanest hook point — to also invoke
`useSelectionStore.getState().clearAll()`, which clears `selection`, `ghost`,
and `axisPicker`.

We considered subscribing to `temporal.subscribe(...)` instead but rejected
it: it fires on every mutation of pastStates / futureStates including
incidental state changes, and detecting "this was an undo/redo" by length
comparison is brittle. Wrapping the call sites is two lines and explicit.

Keyboard shortcuts (`Ctrl+Z`, `Ctrl+Shift+Z`/`Ctrl+Y`) go through the same
component handlers, so they get the same coupling for free.

## New canvas-store actions

Each is one `set(...)` call so zundo records one undo step:

```ts
applyMove(sourceMask: SelectionMask, ghostLines: Line[]): void
// Removes lines belonging to sourceMask (inclusive); writes ghostLines.

applyDelete(mask: SelectionMask): void
// Removes lines belonging to mask (inclusive). No ghost involved.

applyPaste(ghostLines: Line[]): void
// Writes ghostLines. No source removal.

applyMirror(sourceMask: SelectionMask, ghostLines: Line[]): void
// Same as applyMove — original removed, mirrored copy written. (Mirror
// "replaces" the source per image-editor convention.)
```

`applyDelete` is a single transaction even though a selection may cover
hundreds of lines — the existing `removeMultipleLines` is the implementation
target.

## Performance

- Lasso point collection: bounded by min-distance, so a 2-second drag yields
  ~50 points max. Point-in-polygon over a few hundred cells is sub-ms.
- Ghost adjust: O(n) where n = ghost line count (typically <200).
  Per arrow-key adjust: trivial.
- Marching-ants RAF: only runs when `selection || ghost || axisPicker`
  exists. Static canvas redraw is not triggered by overlay frames.
- For very large canvases (1000×1000+), one could clip marching-ants drawing
  to viewport rect. Out of scope for this change.

## Risks and mitigations

- **Modifier conflicts during tool switching.** If the user holds `Shift`,
  switches tool, releases — the in-progress drag could trigger unwanted
  refinement. Mitigation: tool switch always cancels any in-progress drag.
- **Mobile gesture collisions.** Long-press = erase exists. Selection mode
  redefines single-finger drag. Mitigation: long-press handler in
  `useCanvasTouchInteraction` is gated on `tool === 'draw'`.
- **Undo of cut, then paste.** If the user cuts (clipboard captured, lines
  removed), then undoes the cut, the lines are restored — but the clipboard
  still contains them. Pasting now creates duplicates. This is intentional
  and matches mainstream image-editor behavior.
- **Ghost out-of-bounds.** Moving past canvas edge would create lines with
  negative or out-of-range coords. Mitigation: `adjustGhost` clamps so the
  ghost bbox stays in `[0, width] × [0, height]`.
- **Selection on shrunk canvas.** `resizeCanvas` / `setCanvasSize` could
  invalidate cells in the mask. Mitigation: those store actions also clear
  the selection (one extra line each).

## Out of scope (deferred to future changes)

- Rotation by 90° or 180° (different aspect-ratio handling needed; user
  explicitly chose mirror over rotate).
- Multi-clipboard or clipboard history.
- Cross-scheme paste.
- Selection serialization (save selection across reloads).
- Snapping ghost to grid landmarks beyond cell-boundary alignment.
- Animated transitions on commit.
