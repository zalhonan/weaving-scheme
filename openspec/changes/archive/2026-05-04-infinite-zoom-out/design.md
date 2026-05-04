# Design — infinite-zoom-out

## Goals

Enable visual overview of large schemes (1000×1000 cells fitting on a typical
laptop screen) by lowering the zoom-out floor and reshaping the rendering and
zoom-step pipelines so the result looks coherent and runs at frame rate.
Editing fidelity at default zoom is preserved exactly; the smaller cell sizes
are explicitly a *view* mode, not an *edit* mode.

A second goal — equal in importance per the user's explicit ask — is
**regression protection**. Every existing feature (drawing, advanced drawing,
selection / move / mirror / rotate, colors, highlights, tails, undo/redo,
import/export, print, touch) must keep working at `cellSize ≥ 8` exactly as
before. New behavior is additive below that threshold.

## The four moving parts

```
  user turns wheel
        │
        ▼
  multiplicative zoom step  ◀── (1) replaces additive ±2
        │
        ▼
  new cellSize (clamped to [0.5, 50])
        │
        ▼
  renderer chooses rendering profile  ◀── (2) adaptive thresholds
        │            from cellSize
        ▼
  iterates only visible cell range  ◀── (3) viewport culling
        │
        ▼
  draws frame
```

Plus (4) a one-shot `fitToView()` action that bypasses the wheel and goes
straight to a target `cellSize` + `offset` computed from the viewport size.

These four are independent enough to ship and review separately, and
sequenced so each can be merged without breaking the build:

1. **Multiplicative zoom** (no user-visible behavior change at `cellSize ≥ 8`)
2. **Lower the floor** (now reachable; rendering may be ugly until 3 lands)
3. **Adaptive rendering + culling** (makes the floor look good and fast)
4. **Fit-to-view button + hotkey** (UX polish)

## (1) Multiplicative zoom

### Problem

Current step in `useCanvasInteraction.ts:595`:

```ts
const delta = e.deltaY > 0 ? -2 : 2;
zoom(delta, x, y);
```

Inside `useViewportStore.ts:28-31`:

```ts
const newCellSize = Math.max(MIN, Math.min(MAX, cellSize + delta));
```

At `cellSize = 25`, one tick is 8 % — fine. At `cellSize = 2`, one tick is
100 % — useless. We can't reach 0.5 from 25 with `±2` steps without
clamping issues, and even if we could, the felt-speed would be
catastrophically uneven.

### Solution

Replace the additive step with a multiplicative factor:

```ts
// useViewportStore.ts (new signature)
zoom: (factor: number, cursorX: number, cursorY: number) => {
  const newCellSize = clamp(cellSize * factor, MIN, MAX);
  if (newCellSize === cellSize) return;
  const scale = newCellSize / cellSize;
  set({
    cellSize: newCellSize,
    offsetX: cursorX - (cursorX - offsetX) * scale,
    offsetY: cursorY - (cursorY - offsetY) * scale,
  });
};
```

Cursor-anchor math is **unchanged** — the same `scale = newCellSize / cellSize`
formula that's there today already works because it's defined in terms of the
ratio, not the delta. This is the key insight that lets us swap the contract
without touching the anchor logic.

Wheel handler:

```ts
// useCanvasInteraction.ts:handleWheel
const ZOOM_FACTOR = 1.08;  // ~8% per tick, matches felt speed at cellSize=25
const factor = e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR;
zoom(factor, x, y);
```

Pinch handler in `useCanvasTouchInteraction.ts:419-429` already computes
`scale = currentDistance / initialDistance` — feed that ratio directly into
`zoom(scale, midX, midY)` and update `initialDistance` on each frame. Drop
the `(scale - 1) * 10` translation step entirely.

### Calibration

| cellSize | additive step (today) | multiplicative step (×1.08) |
|---------:|----------------------:|----------------------------:|
| 50       | ±2 (4 %)              | ±4 (8 %)                    |
| 25       | ±2 (8 %)              | ±2 (8 %)                    |
| 10       | ±2 (20 %)             | ±0.8 (8 %)                  |
| 4        | ±2 (50 %)             | ±0.32 (8 %)                 |
| 1        | ±2 (200 %, clamped)   | ±0.08 (8 %)                 |

A factor of 1.08 is calibrated so that **at the default zoom level, one tick
moves the same number of pixels as today** — meeting the "wheel speed must
not feel different" regression requirement.

To traverse 25 → 0.5 takes `log(0.5/25) / log(1/1.08) ≈ 51` ticks. That's
high. The fit-to-view button compensates — heavy zoom-out is one click, not
51 wheel ticks.

## (2) Lower the floor

```
  src/types/viewport.ts:
    MIN_CELL_SIZE: 8  →  0.5
    MAX_CELL_SIZE: 50  (unchanged)
    DEFAULT_CELL_SIZE: 25  (unchanged)
```

`0.5` not `1` so that on smaller viewports (e.g. tablets in landscape, ~1000 px
wide) a 1000×1000 grid still fits with margin. At `cellSize = 0.5`, a
1000-cell grid is 500 px wide.

### Constants consolidation

`CANVAS_CONSTANTS` in `src/constants/canvas.ts:1-15` duplicates these three
values. The constants file additionally holds genuinely-rendering constants
(`NUMBER_AREA_WIDTH`, `HIT_TOLERANCE`, `GRID_COLOR`, etc.) that have no
business in `types/viewport.ts`.

Resolution: keep both files but stop duplicating the cell-size limits.
`CANVAS_CONSTANTS` re-exports them from `VIEWPORT_LIMITS`. Renderer imports
stay the same path. Concrete:

```ts
// src/constants/canvas.ts
import { VIEWPORT_LIMITS } from '../types/viewport';

export const CANVAS_CONSTANTS = {
  // re-export so existing renderer/util imports of CANVAS_CONSTANTS keep working
  MIN_CELL_SIZE: VIEWPORT_LIMITS.MIN_CELL_SIZE,
  MAX_CELL_SIZE: VIEWPORT_LIMITS.MAX_CELL_SIZE,
  DEFAULT_CELL_SIZE: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,
  // genuinely-rendering constants stay here
  NUMBER_AREA_WIDTH: 30,
  HIT_TOLERANCE: 0.25,
  // …
} as const;
```

A grep audit at the end of the change must confirm only one literal `8`,
`50`, `25` exists for cell-size limits — in `viewport.ts`.

## (3) Adaptive rendering + viewport culling

### Adaptive thresholds

The renderer currently draws six layers unconditionally. New rule: each layer
gates on `cellSize` and degrades into a cheaper form (or disappears) when it
becomes visual noise.

| Layer                    | Today (always)           | New gate                          | Below gate                          |
|--------------------------|--------------------------|-----------------------------------|-------------------------------------|
| Cell highlights          | `fillRect`               | always                            | (always; trivially correct)         |
| Minor grid lines         | 1 px stroke per boundary | `cellSize ≥ 2.5`                  | skipped                             |
| Tails (line extensions)  | `cellSize × 0.5` stroke  | `cellSize ≥ 4`                    | skipped                             |
| Major grid (every 10)    | 1.5 px stroke            | `cellSize ≥ 1.5`                  | skipped                             |
| Column / row numbers     | 11 px text               | `cellSize ≥ 8`                    | skipped                             |
| User lines               | 2 px stroke              | `cellSize ≥ 1.5` → stroke as today; otherwise → `fillRect` of cell-edge thickness `max(1, cellSize)` |

Why these thresholds:

- **Numbers ≥ 8.** 11 px font + 1 px padding overlaps adjacent labels at
  cellSize 7. Below 8 they're unreadable; hiding is strictly better.
- **Tails ≥ 4.** `cellSize × 0.5 = 2 px` at cellSize 4 is the last point
  where a stroke is visually distinct. Below that they're subpixel artefacts.
- **Major grid ≥ 1.5.** A 1.5 px stroke on a 1.5 px cell is the cell —
  drawing both is doubling lines. Major grid is decorative at small zoom.
- **Minor grid ≥ 2.5.** Two adjacent 1 px strokes with a `< 1 px` gap merge.
- **User lines fallback at < 1.5.** A 2 px stroke spans more than a cell —
  adjacent lines smear. Fall back to `fillRect` of width `max(1, cellSize)`
  on the cell edge:
  ```
   horizontal line at (x, y), cellSize=1:
     fillRect(gridStart + x*1, gridStart + y*1 - 0.5, 1, 1)
   vertical line at (x, y):
     fillRect(gridStart + x*1 - 0.5, gridStart + y*1, 1, 1)
  ```
  This produces a coherent dot/dash pattern instead of a smear.

The thresholds are **constants** in `renderer.ts` (or moved to
`CANVAS_CONSTANTS`), single source of truth, easy to tune.

### Viewport culling

Today (`renderer.ts:60-73`):

```ts
for (let cellX = 0; cellX < canvasWidth; cellX++) {
  for (let cellY = 0; cellY < canvasHeight; cellY++) {
    if (getCellColor) { … }
  }
}
```

`canvasWidth` and `canvasHeight` are the *grid dimensions* (the unfortunate
parameter naming — they're `width` and `height` from `useCanvasStore`, not
display pixels). At 1000×1000 that's 1M iterations even when blank. Same
problem for the grid-line and tail loops.

New helper at the top of `renderCanvas`:

```ts
const visibleMinX = Math.max(0, Math.floor((-offsetX - numberArea) / cellSize));
const visibleMaxX = Math.min(canvasWidth, Math.ceil((displayWidth - offsetX - numberArea) / cellSize));
const visibleMinY = Math.max(0, Math.floor((-offsetY - numberArea) / cellSize));
const visibleMaxY = Math.min(canvasHeight, Math.ceil((displayHeight - offsetY - numberArea) / cellSize));
```

All cell/grid/tail loops iterate `[visibleMinX, visibleMaxX)` and
`[visibleMinY, visibleMaxY)`. The major-grid loop must round its start *down*
to the previous multiple of `MAJOR_GRID_INTERVAL` to avoid clipping the line
at the visible edge.

User-line loop already uses `lines.forEach` — add an in-loop check:

```ts
lines.forEach((line, key) => {
  if (line.x < visibleMinX - 1 || line.x > visibleMaxX) return;
  if (line.y < visibleMinY - 1 || line.y > visibleMaxY) return;
  …
});
```

(The `-1` is because horizontal lines at `y = N` belong to cell row `N-1` or
`N` — we err on the side of including borderline lines.)

### Off-by-one risk

The hairy edge case: at cellSize=1 with a fractional offset, `floor` vs
`ceil` decisions can leave a 1-pixel band at the visible edge un-rendered, or
double-render the boundary. The strategy is "err on the side of one extra
cell on each edge" — `-1`/`+1` padding inside the visible bounds. Worst case:
~4 extra rows/cols rendered. At 1000×1000 culled to a typical viewport that's
still ~50k iterations vs 1M without culling — 20× speedup, not the theoretical
max but plenty.

## (4) Fit to view

### Action

```ts
// useViewportStore.ts
fitToView: (viewportWidth: number, viewportHeight: number) => {
  const { width, height } = useCanvasStore.getState();  // grid dims
  const numberArea = CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
  const padding = 16;  // breathing room
  const fitW = (viewportWidth - numberArea - padding * 2) / width;
  const fitH = (viewportHeight - numberArea - padding * 2) / height;
  const targetCellSize = clamp(
    Math.min(fitW, fitH),
    VIEWPORT_LIMITS.MIN_CELL_SIZE,
    VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,  // never zoom *in* past default for a tiny canvas
  );
  // Center the grid in the viewport.
  const gridPxW = width * targetCellSize;
  const gridPxH = height * targetCellSize;
  const offsetX = (viewportWidth - numberArea - gridPxW) / 2;
  const offsetY = (viewportHeight - numberArea - gridPxH) / 2;
  set({ cellSize: targetCellSize, offsetX, offsetY });
};
```

The action takes viewport dims so it stays a pure store action — the caller
(button handler / hotkey handler) measures the canvas element and passes them
in. This is consistent with how `zoom()` already takes screen-space cursor
coordinates.

### Cross-store dependency

`fitToView` reads `useCanvasStore.getState().{ width, height }`. There is
already a precedent for cross-store reads (selection store reads canvas store
in `useSelectionStore.ts`). Acceptable.

### UI

New `src/components/Sidebar/ViewControl.tsx` rendering a single button
"Вписать в экран" / icon, calling `fitToView(canvas.clientWidth,
canvas.clientHeight)`. Placed in the sidebar above `UndoRedo` (it's a
view-only navigation tool — closer to viewport ops than to data ops).

Hotkey `0` in `useCanvasShortcuts.ts`. Choice rationale:

- Free in the existing shortcut map (only mod+0 / ctrl+0 are taken by the
  browser — bare `0` is ours).
- Matches Figma / Sketch / Photoshop convention for "fit canvas to screen".
- Documented in `HotkeysInfo.tsx`.

Touch users access fit-to-view via the sidebar (☰ on mobile). A floating FAB
is a follow-up.

## Regression protection — what must NOT change

Listed explicitly because the user requested it:

1. **At `cellSize ≥ 8`, every layer renders identically** to today.
   Verifiable via a pixel-snapshot test: render a fixed canvas at cellSize 8,
   12, 25, 50; assert the resulting `ImageData` is byte-identical pre/post.
2. **Cursor-anchor math is preserved.** Existing US-2.1 acceptance criterion
   "Масштабирование относительно позиции курсора" must still hold — explicit
   test: zoom in/out with cursor at a known cell; assert that cell stays
   under the cursor (within ½ px).
3. **Felt wheel speed at default zoom is unchanged ±10 %.** Calibrated above
   (8 % per tick at cellSize 25 = 2 px, same as additive ±2 today).
4. **All existing user stories continue to pass.** Concretely: US-2.x (zoom
   limits expanded, all other criteria unchanged), US-3.x (advanced drawing
   gestures), US-4.x (colors, highlights), Эпик 7 (selection / move / mirror /
   rotate / clipboard) — selection works on the visible cell range,
   independent of culling. Touch US-6.x.
5. **No localStorage migration.** A pre-change snapshot loaded post-change
   produces an identical `useCanvasStore` state. Test: write a fixture
   snapshot string into localStorage, reload, assert state equals expected.
6. **No regression in tests.** All 93 existing tests in `__tests__/` pass
   without modification. Any new tests added are in addition to, not in place
   of, existing tests.
7. **Hit-testing thresholds unchanged.** `HIT_TOLERANCE = 0.25` and
   `TOUCH_HIT_TOLERANCE = 0.33` are not touched. Drawing accuracy at
   cellSize 8+ is identical.
8. **Persisted store shapes unchanged.** No new persisted fields. No removed
   fields. No renamed fields.
9. **Adaptive rendering thresholds are one-way.** Rendering at `cellSize = 8`
   matches today exactly — every threshold sits *below* 8 so the existing
   visible regime is bit-for-bit preserved.

## Implementation order

The order in `tasks.md` is chosen so each milestone leaves the app in a
shippable state:

1. Constants consolidation (no behavior change; pure refactor; sets up the
   ground for the next steps).
2. Multiplicative zoom (no behavior change at `cellSize ≥ 8` because
   nothing reaches the new floor yet).
3. Viewport culling (pure perf optimization, behavior identical).
4. Adaptive rendering thresholds (behavior changes only at the new low
   `cellSize` values).
5. Lower the floor (now actually reachable; everything below is supported).
6. Fit-to-view button + hotkey.
7. Tests + docs + validate.

## Open questions / deferred

- A floating mobile FAB for fit-to-view. Sidebar entry covers MVP; promote in
  a follow-up if mobile users complain.
- A keyboard shortcut for "100 %" (reset to default zoom centered). Today's
  `reset()` does this already; not adding a hotkey unless asked.
- Dynamic threshold tuning per-DPR. At DPR=2, all the numeric thresholds
  (font readability, stroke distinguishability) are at half the cellSize.
  Probably fine to ignore until a HiDPI user complains; thresholds can be
  multiplied by `1 / dpr` if needed without spec changes.
