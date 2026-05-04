# infinite-cells-on-print

## Why

PDF printing is currently capped at 100 cells per page horizontally
(`max="100"` on the input + `<= 100` validation in
`src/components/Sidebar/ExportImport.tsx:64`). For users working with
1000×1000 schemes (see `infinite-zoom-out`) this means a full pattern is
always split across 100+ pages — there is no way to produce a single-page
overview / thumbnail. Printing is also locked to portrait orientation,
which wastes 30–40 % of the usable area for non-square canvases.

This change removes the artificial cap, adds a "Fit on one page" button
that computes the exact `cellsPerPageX` for a single-page output, adds a
portrait/landscape orientation selector, and introduces adaptive PDF
rendering so the output stays coherent at very small cell sizes (where
6 pt text would overlap and 0.4 mm strokes would smear across cells).

## What Changes

- print: lift the `cellsPerPage` cap. Input `min="1"` stays; `max` and
  the corresponding `<= 100` validation are removed. Only invalid values
  (NaN, < 1, negative) are rejected.
- print: add a "Уместить на 1 страницу" button next to the
  `cellsPerPage` input. Clicking it computes
  `Math.max(width, Math.ceil(height × usable_w / usable_h))` for the
  current orientation and writes the result into the input field.
- print: add an orientation selector (`portrait` | `landscape`) on the
  Файл panel. Selection drives both the `jsPDF` orientation parameter
  and the `USABLE_WIDTH` / `USABLE_HEIGHT` constants used for layout.
  Default stays `portrait`.
- print: introduce adaptive rendering thresholds in `generatePDF`:
  numbers, minor grid, major grid, and user-line stroke width all gate
  on `cellSizeMM`. Above the existing default cell size (~7 mm) nothing
  changes; below the thresholds layers degrade or disappear. User-line
  stroke width is clamped to `min(0.4, cellSizeMM × 0.9)` so a 0.4 mm
  stroke does not span multiple sub-millimetre cells.
- ui: replace the existing single-line `cellsPerPage` block with a
  small grouped control: orientation toggle + cells-per-page input +
  fit button. Wording stays Russian, matches the rest of the panel.

## Impact

- **Affected specs:** new capability `print` (spec added by this change).
- **Affected code areas:**
  - `src/utils/printPDF.ts` — orientation parameter; adaptive
    thresholds; line-width clamping; `USABLE_WIDTH` / `USABLE_HEIGHT`
    derived from orientation
  - `src/components/Sidebar/ExportImport.tsx` — orientation state,
    fit-to-page button, lifted input cap
  - `src/components/Sidebar/Sidebar.module.css` — minor layout for the
    new print-settings group (no other selectors change)
  - `documentation/user-stories.md` — update US-5.3, add US-5.4
    (orientation + fit-to-page + adaptive thresholds)
  - `documentation/epics.md` — Эпик 5 bullet update
- **Persisted localStorage migration:** **not required.** Both
  `cellsPerPage` and the new `orientation` are local React state in
  `ExportImport.tsx` — same persistence model as before (none).
  `useCanvasStore` and other persisted state are untouched.
- **Desktop behavior:** unchanged for sizes ≤ 100 cells/page in portrait.
  New cap is effectively unlimited; the orientation selector exposes a
  pre-existing `jsPDF` feature; the fit button is one click.
- **Touch behavior:** the print panel is already opened from the
  sidebar (☰ on mobile). New controls inherit the same touch path with
  no extra plumbing — buttons and a `<select>` render natively.
- **Regression protection (explicit user requirement, mirrors the
  `infinite-zoom-out` contract):**
  - At `cellSizeMM ≥ 2 mm` (corresponding roughly to `cellsPerPageX ≤ 91`
    in portrait — i.e. the entire pre-change valid range), the PDF
    output is byte-identical to the pre-change generator. Verified via
    a structural test counting `pdf.text` / `pdf.line` / `pdf.rect`
    calls at `cellsPerPage ∈ {25, 50, 100}`.
  - All adaptive thresholds sit *below* the current default
    `cellsPerPage = 25` (which gives `cellSizeMM = 7.28 mm`). The
    default-zoom output is bit-for-bit preserved.
  - Default orientation stays `portrait`. A user who never touches the
    new selector gets identical output.
  - All 123 existing tests in `__tests__/` continue to pass without
    modification.
  - `npm run typecheck && npm run lint && npm run test` green.
  - Page-number footer ("Page N / M [column X, row Y]") is unchanged
    in format, position, and content for any page count.

## Non-Goals

- Auto-orientation. The fit button respects the current orientation
  rather than picking the better of the two — explicit user control.
  A future "auto" option could be added with one-line UI extension.
- Persisting `cellsPerPage` or `orientation` across sessions. They
  remain local React state — same as today.
- Rendering thumbnails on screen before print. The PDF preview is the
  preview; pre-render UI is its own change.
- A landscape-only layout overhaul (e.g. moving the page-number footer
  to a side rail). Layout constants are kept; only their values are
  swapped per orientation.
- Variable per-page cell sizes within one document. All pages share the
  same `cellsPerPageX` / `cellSizeMM`.
- Different paper sizes (Letter, A3, etc.). Stays A4, same as today.
