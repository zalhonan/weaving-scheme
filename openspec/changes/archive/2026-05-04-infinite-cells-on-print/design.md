# Design — infinite-cells-on-print

## Goals

Let the user produce a one-page overview of any canvas size (including
1000×1000) by lifting the `cellsPerPage = 100` cap, exposing landscape
orientation, and giving the math a single button. Where small cell sizes
would otherwise produce overlapping numbers and smeared strokes, render
adaptively — same philosophy as `infinite-zoom-out` shipped for the
on-screen canvas.

The second non-negotiable goal: **no regression at any pre-change valid
input** (1 ≤ `cellsPerPage` ≤ 100, portrait orientation). All adaptive
thresholds sit below the smallest cell size reachable in that range, so
the existing PDF byte-stream is preserved.

## Four moving parts

```
   ┌──────────────────────────────────────────────────────┐
   │  ExportImport.tsx  (UI)                              │
   │                                                      │
   │   ┌─Orientation──┐  ┌─Cells/page──┐  ┌─Fit btn──┐    │
   │   │ ◉ Portrait   │  │  [   25 ]   │  │ ⤢ Fit   │    │
   │   │ ◯ Landscape  │  └──────┬──────┘  └────┬─────┘    │
   │   └──────┬───────┘         │              │          │
   │          │                 │              ▼          │
   │          ▼                 │       computes max(W,   │
   │       persists in          ▼       ceil(H*UW/UH))    │
   │       useState             reads input               │
   └──────────┬───────────────────┬─────────────────────┘
              │                   │
              ▼                   ▼
   ┌─────────────────────────────────────────────────────┐
   │  printPDF.ts:generatePDF(opts)                      │
   │                                                     │
   │   1. Pick {USABLE_W, USABLE_H} from orientation     │
   │   2. cellSizeMM = USABLE_W / cellsPerPageX          │
   │   3. Derive RenderProfileMM from cellSizeMM         │
   │      (numbers, minor grid, major grid, line width)  │
   │   4. Per-page render obeys profile                  │
   └─────────────────────────────────────────────────────┘
```

These four changes are independent enough to ship and verify in order:

1. **Orientation parameter** plumbed through (still always portrait
   default — no behavior change at default).
2. **Lift the input cap** (now reachable; rendering may look ugly until
   step 3 lands).
3. **Adaptive rendering profile** in `generatePDF` (makes large values
   look reasonable).
4. **Fit button** (UX polish on top of the now-correct math).

## (1) Orientation

### Page constants by orientation

```
                  PAGE_W   PAGE_H   USABLE_W   USABLE_H   aspect (UW/UH)
portrait (today)   210      297       182        259        0.703
landscape          297      210       269        172        1.564
```

Same margins (10 mm), same number area (8 mm on left + top), same page-
number reservation (10 mm at bottom). Only `PAGE_W` / `PAGE_H` swap.

### State in UI

```ts
// ExportImport.tsx
const [cellsPerPage, setCellsPerPage] = useState(25);
const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
```

Both stay component-local — neither is persisted, matching the existing
`cellsPerPage` model. A future change can promote to a store if cross-
session memory becomes a feature ask.

### Plumbing into `generatePDF`

```ts
interface PrintOptions {
  // ...existing fields...
  cellsPerPageX?: number;
  orientation?: 'portrait' | 'landscape';   // NEW, optional
}
```

`orientation` defaults to `'portrait'` — that's the regression contract.
A caller that never sets it gets identical output to today.

Inside `generatePDF`:

```ts
const isLandscape = orientation === 'landscape';
const PAGE_WIDTH  = isLandscape ? 297 : 210;
const PAGE_HEIGHT = isLandscape ? 210 : 297;
const USABLE_WIDTH  = PAGE_WIDTH  - 2 * MARGIN - NUMBER_AREA_MM;
const USABLE_HEIGHT = PAGE_HEIGHT - 2 * MARGIN - NUMBER_AREA_MM - 10;
const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
```

The constants `MARGIN = 10` and `NUMBER_AREA_MM = 8` and the 10 mm
page-number reservation stay literal. The page-number footer position
(`PAGE_WIDTH / 2`, `PAGE_HEIGHT - MARGIN / 2`) follows the rotated dims
naturally.

## (2) Lift the cap

`src/components/Sidebar/ExportImport.tsx:62-67`:

```ts
// before
const handleCellsPerPageChange = (e) => {
  const value = parseInt(e.target.value, 10);
  if (!isNaN(value) && value >= 1 && value <= 100) {
    setCellsPerPage(value);
  }
};

// after
const handleCellsPerPageChange = (e) => {
  const value = parseInt(e.target.value, 10);
  if (!isNaN(value) && value >= 1) {
    setCellsPerPage(value);
  }
};
```

Input element loses `max="100"`; `min="1"` stays.

## (3) Fit-to-page math

The fit button computes the smallest `cellsPerPageX` such that the whole
canvas fits on a single page. Derivation:

```
need:  cellsPerPageX ≥ width
       cellsPerPageY ≥ height

cellSizeMM    = USABLE_W / cellsPerPageX
cellsPerPageY = floor(USABLE_H / cellSizeMM)
              = floor(USABLE_H × cellsPerPageX / USABLE_W)

For cellsPerPageY ≥ height:
  USABLE_H × cellsPerPageX / USABLE_W ≥ height          (loosely, ignoring floor)
  cellsPerPageX ≥ height × USABLE_W / USABLE_H

Take ceil to guarantee floor() does not drop us below height:
  cellsPerPageX ≥ ceil(height × USABLE_W / USABLE_H)
```

Combined:

```ts
const fitOnePage = Math.max(
  width,
  Math.ceil(height * USABLE_WIDTH / USABLE_HEIGHT)
);
```

### Rounding correctness check

The `ceil` is enough because:

```
cellsPerPageY = floor(USABLE_H × cellsPerPageX / USABLE_W)
             ≥ floor(USABLE_H × ceil(H × USABLE_W / USABLE_H) / USABLE_W)
             ≥ floor(USABLE_H × (H × USABLE_W / USABLE_H) / USABLE_W)
             = floor(H) = H
```

Verified for representative sizes:

```
canvas         orient.    fitOnePage   cellSizeMM    pages    binding axis
─────────────────────────────────────────────────────────────────────────
 100 × 100     portrait     100         1.82          1 × 1   X
 100 × 200     portrait     141         1.29          1 × 1   Y
 500 × 500     portrait     500         0.36          1 × 1   X
1000 × 1000    portrait    1000         0.18          1 × 1   X
1000 ×  500    portrait    1000         0.18          1 × 1   X
 500 × 1000    portrait     704         0.26          1 × 1   Y
1000 × 1000    landscape   1564         0.17          1 × 1   Y
1000 ×  500    landscape   1000         0.27          1 × 1   X (better than portrait)
 500 × 1000    landscape   1564         0.17          1 × 1   Y (worse than portrait)
```

For non-square canvases orientation matters: 1000×500 is 33 % more
legible in landscape; 500×1000 is 35 % more legible in portrait. The fit
button respects the user's orientation — they can flip and click again.

## (4) Adaptive rendering profile

Same shape as the canvas-renderer profile from `infinite-zoom-out`, but
calibrated for printer output and using mm thresholds.

```
cellSizeMM    layer behavior
──────────    ─────────────────────────────────────────────────
   ≥ 2.0      everything as today (regression-safe band)
 0.5..2.0     numbers (font 6 ≈ 2.1 mm) hidden — would overlap
 0.3..0.5     + minor grid (0.1 mm stroke) hidden — visual noise
   < 0.3      + major grid hidden
   < 0.4      user-line stroke width clamped to cellSizeMM × 0.9
              (instead of constant 0.4 mm) — prevents smearing
              across multiple sub-mm cells
```

Concretely:

```ts
interface RenderProfileMM {
  showNumbers:    boolean;   // cellSizeMM >= 2.0
  showMinorGrid:  boolean;   // cellSizeMM >= 0.5
  showMajorGrid:  boolean;   // cellSizeMM >= 0.3
  userLineWidth:  number;    // min(0.4, cellSizeMM * 0.9)
}
```

Why each threshold:

- **Numbers ≥ 2.0 mm.** `setFontSize(6)` is 6 pt ≈ 2.12 mm. Below the
  cell size, adjacent labels collide. Hiding is strictly better than
  overlap.
- **Minor grid ≥ 0.5 mm.** A 0.1 mm stroke at 0.5 mm cell takes 20 % of
  the cell — still distinguishable. Below 0.5 mm cells, two adjacent
  strokes start to merge into one wider line.
- **Major grid ≥ 0.3 mm.** 0.2 mm stroke on 0.3 mm cell is 67 % of the
  cell — past this point, every-10 lines blur with cells.
- **User-line clamp.** A 0.4 mm stroke centred on a cell boundary
  extends 0.2 mm to each side. When `cellSizeMM < 0.4`, the stroke
  spans more than one cell — adjacent lines smear into each other. The
  fix is to shrink the stroke to a fixed fraction of the cell, never
  exceeding the original 0.4 mm. `cellSizeMM × 0.9` keeps strokes
  visible (printer resolution ~0.04 mm) without bleed.

### Thresholds vs default cell size

Default `cellsPerPage = 25` in portrait gives `cellSizeMM = 182 / 25 =
7.28 mm`. All gates open. Any pre-change valid input (≤ 100) gives
`cellSizeMM ≥ 1.82 mm` — only the *numbers* gate would close at the
extreme. To preserve byte-identical output across the entire pre-change
range, we pin the numbers threshold a hair below 1.82:

> **Decision:** `NUMBERS_MIN_CELL_MM = 1.8` (not 2.0).
>
> Rationale: at `cellsPerPage = 100` portrait, `cellSizeMM = 1.82` —
> setting the threshold to 2.0 would hide numbers in this previously-
> valid configuration, breaking regression contract. 1.8 mm keeps the
> entire pre-change range bit-for-bit identical and only closes when the
> new uncapped values are reached.

Final thresholds:

```ts
NUMBERS_MIN_CELL_MM     = 1.8;
MINOR_GRID_MIN_CELL_MM  = 0.5;
MAJOR_GRID_MIN_CELL_MM  = 0.3;
USER_LINE_WIDTH_BASE_MM = 0.4;   // existing default
```

### Why not fillRect for user lines (parallel canvas)

The canvas renderer falls back to `fillRect` at sub-1.5 px cell size
because pixels are integer-aligned and a 2-px stroke really does smear.
For PDF, strokes are vector — clamping the line width achieves the same
visual effect (no bleed) while preserving stroke continuity along
adjacent cells. Continuous strokes read better than dot patterns at
print resolution.

## Regression protection — what must NOT change

1. **Default `orientation` is `portrait`.** A caller who omits the
   parameter gets identical output.
2. **At `cellsPerPage` ≤ 100 in portrait, output is byte-identical**
   to today — verified by structural-call-count test on
   `cellsPerPage ∈ {1, 25, 50, 100}` (counts of `pdf.text`, `pdf.line`,
   `pdf.rect`, `pdf.setFont`, `pdf.setDraw*` match pre-change exactly).
3. **All thresholds activate strictly below the pre-change valid range.**
   The numbers threshold is set to 1.8 mm (not the more natural 2.0 mm)
   precisely to preserve `cellsPerPage = 100` (which gives 1.82 mm).
4. **Page-number footer text and position unchanged** for any page
   count — same `pageInfo` template, same `(PAGE_WIDTH / 2,
   PAGE_HEIGHT - MARGIN / 2)` placement.
5. **`PrintOptions.orientation` is optional.** Existing callers
   (currently only `ExportImport.tsx`) compile and run without
   modification.
6. **No localStorage shape change.** `useCanvasStore` and other
   persisted state are untouched. Pre-change snapshots load identically.
7. **All 123 existing tests pass without modification.** New tests are
   additive.
8. **Hit-testing, drawing, selection, undo/redo unchanged.** This is a
   print-only change; canvas rendering is not touched.
9. **Input `min="1"` retained.** Zero would divide-by-zero;
   negative/NaN are still rejected.

## Implementation order

Sequenced so each milestone leaves a green build:

1. Add `orientation` to `PrintOptions` (optional, default portrait) and
   thread to `jsPDF` constructor + page-dim selection. **No UI change
   yet.** Existing callers stay valid because the parameter is optional.
2. Add the `RenderProfileMM` helper and per-layer gates. With current
   defaults nothing visibly changes.
3. Clamp user-line stroke width.
4. Lift the input cap (`max` attr + `<= 100` check).
5. Add the orientation selector to `ExportImport.tsx`.
6. Add the fit-to-page button.
7. Tests + docs + validate.

## Open questions / deferred

- **A "Auto-orientation" preset.** The fit button could pick the better
  of portrait/landscape. Out of scope per user — they want explicit
  control. One-line UI extension if asked later.
- **Persisting orientation / cellsPerPage.** Local state today; same
  going forward. If users want their last print settings remembered,
  promote to `useUIStore`. Not in scope here.
- **Mobile FAB for fit-to-page.** Sidebar entry covers the use case;
  promote later if needed.
- **Per-page cell sizes / variable layout.** Out of scope.
- **Paper-size selector (Letter, A3, etc.).** A3 in particular would let
  1000×1000 print at ~0.36 mm/cell instead of 0.18, which is a real
  legibility win — but it's a separate change with its own UI surface
  and constant table.
