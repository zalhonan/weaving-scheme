# Tasks — infinite-cells-on-print

## 1. Types

- [x] 1.1 Extend `PrintOptions` in `src/utils/printPDF.ts` with optional
      `orientation?: 'portrait' | 'landscape'` (default `'portrait'`).
      Run `npm run typecheck`.

## 2. Utils — Renderer (printPDF.ts)

- [x] 2.1 Inside `generatePDF`, derive `PAGE_WIDTH` / `PAGE_HEIGHT` /
      `USABLE_WIDTH` / `USABLE_HEIGHT` from `orientation`. Pass
      `orientation` to the `jsPDF` constructor. Run `npm run typecheck`.
- [x] 2.2 Introduce a `RenderProfileMM` helper at the top of
      `printPDF.ts` deriving from `cellSizeMM`:
      `showNumbers` (≥ 1.8), `showMinorGrid` (≥ 0.5),
      `showMajorGrid` (≥ 0.3), `userLineWidth = min(0.4, cellSizeMM × 0.9)`.
      Thresholds as named constants at file top.
- [x] 2.3 Gate the column- and row-number `pdf.text` loops on
      `profile.showNumbers`.
- [x] 2.4 Gate the minor-grid `pdf.line` loops on `profile.showMinorGrid`.
- [x] 2.5 Gate the major-grid `pdf.line` loops on `profile.showMajorGrid`.
- [x] 2.6 Replace the constant `pdf.setLineWidth(0.4)` for user lines
      with `pdf.setLineWidth(profile.userLineWidth)`.
- [x] 2.7 Verify the page-number footer (`pageInfo` text + position)
      uses the new `PAGE_WIDTH` / `PAGE_HEIGHT` correctly under both
      orientations. Run `npm run typecheck`.

## 3. Components — ExportImport

- [x] 3.1 Add `orientation` state in `ExportImport.tsx`:
      `useState<'portrait' | 'landscape'>('portrait')`. Run
      `npm run typecheck`.
- [x] 3.2 Add an orientation selector to the print-settings group —
      either a `<select>` or two radio buttons (label "Ориентация",
      options "Портретная" / "Альбомная"). Wire to `setOrientation`.
- [x] 3.3 Pass `orientation` into the `generatePDF` call site.
- [x] 3.4 Lift the input cap: remove `max="100"` from the input element
      and change `<= 100` → no upper bound in `handleCellsPerPageChange`.
      Keep `min="1"` and `>= 1`. Run `npm run typecheck`.
- [x] 3.5 Add a "Уместить на 1 страницу" button next to the
      cellsPerPage input. On click it computes
      `Math.max(width, Math.ceil(height × USABLE_W / USABLE_H))` for
      the current orientation, where `USABLE_W` and `USABLE_H` are
      derived the same way `printPDF.ts` does (extract a shared helper
      `getUsableArea(orientation)` to keep one source of truth).
- [x] 3.6 (CSS) Adjust `Sidebar.module.css` `.printSettings` to lay
      out the three controls cleanly (orientation row, cells/page +
      fit button row). Existing classes only — no new selectors that
      could affect other panels.

## 4. Tests — regression (existing tests must pass UNCHANGED)

- [x] 4.1 `npm run test` confirms all 123 existing tests pass with no
      modifications.
- [x] 4.2 Add `__tests__/utils/printPDF.test.ts` with a recording
      `jsPDF` stub. Call `generatePDF` at `cellsPerPage ∈ {1, 25, 50,
      100}` in portrait and assert the call sequence (counts of
      `pdf.text`, `pdf.line`, `pdf.rect`, `pdf.addPage`,
      `pdf.setLineWidth`, `pdf.setFontSize`) matches a captured
      pre-change baseline. The baseline numbers are computed once and
      hardcoded; any future drift fails the test.
- [x] 4.3 Add a default-orientation regression: omit the new
      `orientation` parameter; assert output is identical to
      `orientation: 'portrait'` (same call sequence, same arg values).

## 5. Tests — new behavior

- [x] 5.1 Adaptive thresholds: render at `cellsPerPage ∈ {120, 200,
      400, 700, 1000}` in portrait, assert (a) numbers disappear when
      `cellSizeMM < 1.8`, (b) minor grid disappears when < 0.5, (c)
      major grid disappears when < 0.3, (d) `pdf.setLineWidth` is
      called with `min(0.4, cellSizeMM × 0.9)` for the user-line layer.
- [x] 5.2 Fit-to-page math: a pure-function unit test for
      `fitOnePage(width, height, orientation)` covering: square
      canvases, tall canvases (Y-binding), wide canvases (X-binding),
      orientation flips for non-square cases. Use the representative
      table from design.md §3.
- [x] 5.3 Landscape regression: at `orientation: 'landscape'`,
      `cellsPerPage = 25` produces a valid PDF with rotated dimensions
      (`PAGE_WIDTH = 297`, etc.) — assert `pdf.line` first and last
      x-coordinates fall within the new usable range, page footer
      lands at `PAGE_HEIGHT - MARGIN / 2 = 205`.
- [x] 5.4 Lifted-cap acceptance: `cellsPerPage = 1000` in portrait
      executes without throwing, produces 1 page (since
      `width × height = 1000 × 1000` fits), and produces a non-empty
      PDF buffer.

## 6. Docs

- [x] 6.1 Update `documentation/user-stories.md` US-5.3 acceptance
      criteria: replace "клетка 7 мм" wording with the
      `cellsPerPage`-driven scheme that already shipped (this is
      pre-existing drift — document the actual implementation).
- [x] 6.2 Add US-5.4 to `documentation/user-stories.md`: «Настройки
      печати — ориентация, произвольное число клеток, кнопка
      "Уместить на 1 страницу"». Acceptance criteria covering all four
      controls and the adaptive thresholds. Update the summary table.
- [x] 6.3 Update `documentation/epics.md` Эпик 5: extend the print
      bullet with "ориентация (портретная / альбомная), произвольное
      количество клеток на страницу, кнопка «Уместить на 1 страницу»,
      адаптивный рендер при сильном сжатии (1000×1000 → 1 страница)".

## 7. Validate

- [x] 7.1 `npm run typecheck && npm run lint && npm run test` — all
      green. No skipped tests.
- [ ] 7.2 Manual smoke check on the dev server (UI verification list,
      single pass) — deferred to user (requires browser):
      - [ ] Print at `cellsPerPage = 25` portrait — output identical to
            today (visual diff or eye check).
      - [ ] Print at `cellsPerPage = 100` portrait — numbers still
            visible (threshold pinned at 1.8 to preserve this case).
      - [ ] Switch orientation to landscape, print at default — page is
            297×210, content respects rotated usable area.
      - [ ] Click "Уместить на 1 страницу" on a 1000×1000 canvas
            (portrait) — input shows 1000, print produces a single
            page thumbnail.
      - [ ] Same on 500×1000 portrait — input shows 704, single page.
      - [ ] Flip to landscape, click fit on 500×1000 — input shows
            1564, single page (numbers and grid hidden, lines visible).
      - [ ] Enter `cellsPerPage = 200` manually — accepted, prints as
            expected (numbers hidden).
      - [ ] Enter `0`, `-5`, `abc` — input value does not change.
      - [ ] Drawing / erasing / selection / undo / export JSON / import
            JSON all work the same as before.
- [x] 7.3 `openspec validate infinite-cells-on-print --strict` — must
      pass without errors.
