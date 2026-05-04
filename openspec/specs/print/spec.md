# print Specification

## Purpose

Defines how the application generates PDF print output from the current
canvas. Covers the cells-per-page input, page orientation, the
fit-to-page action, the adaptive rendering profile that keeps output
coherent at small cell sizes, and the session-only nature of all print
settings.

## Requirements

### Requirement: Cells-Per-Page Range

The system SHALL accept any integer `cellsPerPageX ≥ 1` for PDF print
output. There SHALL be no upper bound enforced by the input control or
the validation logic.

#### Scenario: Lower bound

- **WHEN** the user enters `cellsPerPageX = 0`, a negative number, or
  any non-numeric value
- **THEN** the value is rejected and the previous valid value is
  retained

#### Scenario: Upper bound removed

- **WHEN** the user enters `cellsPerPageX = 1000` (or any positive
  integer beyond the prior 100 cap)
- **THEN** the value is accepted and used for the next print

#### Scenario: Default

- **WHEN** the application loads in a fresh session
- **THEN** `cellsPerPageX` is `25` (unchanged from prior behavior)

### Requirement: Page Orientation

The system SHALL provide a portrait/landscape orientation control that
governs both the `jsPDF` page orientation and the layout constants used
to compute `cellSizeMM` and per-page cell counts.

#### Scenario: Portrait default

- **WHEN** the user has not changed orientation
- **THEN** print uses A4 portrait (`210 × 297 mm`)
- **AND** `USABLE_WIDTH = 182`, `USABLE_HEIGHT = 259` (millimetres)

#### Scenario: Landscape selected

- **WHEN** the user selects landscape orientation
- **AND** triggers print
- **THEN** the generated PDF uses A4 landscape (`297 × 210 mm`)
- **AND** `USABLE_WIDTH = 269`, `USABLE_HEIGHT = 172` (millimetres)
- **AND** the page-number footer renders centered at
  `(PAGE_WIDTH / 2, PAGE_HEIGHT - MARGIN / 2)` of the rotated page

#### Scenario: Orientation is session-local

- **WHEN** the user changes orientation
- **AND** reloads the page
- **THEN** orientation resets to `portrait` (state is React-local, not
  persisted)

### Requirement: Fit-to-Page Action

The system SHALL provide a "Уместить на 1 страницу" button that
computes the smallest `cellsPerPageX` for which the entire canvas
(`width × height` cells) fits on a single A4 page in the current
orientation, and writes that value into the `cellsPerPageX` input.

#### Scenario: Square canvas, portrait

- **GIVEN** `width = 100`, `height = 100`, orientation `portrait`
- **WHEN** the user clicks the fit button
- **THEN** the input value becomes `100`
- **AND** the resulting PDF is exactly one page

#### Scenario: Tall canvas, portrait

- **GIVEN** `width = 100`, `height = 200`, orientation `portrait`
- **WHEN** the user clicks the fit button
- **THEN** the input value becomes `141` (height-binding:
  `ceil(200 × 182 / 259) = 141`)
- **AND** the resulting PDF is exactly one page

#### Scenario: Wide canvas, landscape

- **GIVEN** `width = 1000`, `height = 500`, orientation `landscape`
- **WHEN** the user clicks the fit button
- **THEN** the input value becomes `1000` (width-binding) and the
  cellSize is `0.269 mm`, larger than the same canvas in portrait
  (`0.18 mm`)

#### Scenario: 1000×1000 in portrait

- **GIVEN** `width = 1000`, `height = 1000`, orientation `portrait`
- **WHEN** the user clicks the fit button
- **THEN** the input value becomes `1000`
- **AND** the resulting PDF is exactly one page (a thumbnail with
  numbers and grid hidden per the adaptive profile)

#### Scenario: User can override after fit

- **GIVEN** the fit button has just set the input to a value
- **WHEN** the user manually types a different number
- **THEN** the input accepts the new value (no lock-in from the fit
  action)

### Requirement: Adaptive Print Rendering Profile

The system SHALL adjust which print layers are drawn based on the
current `cellSizeMM`, so that the output stays coherent at small cell
sizes. Each layer SHALL be drawn unchanged at the cell sizes reachable
within the prior valid range (`cellsPerPage` 1..100 in portrait,
`cellSizeMM ≥ 1.82`); below stated thresholds, layers degrade or
disappear.

#### Scenario: Numbers hidden at small cell size

- **WHEN** `cellSizeMM < 1.8`
- **THEN** column-number and row-number `pdf.text` calls are skipped
- **AND** at `cellSizeMM ≥ 1.8` numbers are drawn as before this change

#### Scenario: Minor grid hidden at very small cell size

- **WHEN** `cellSizeMM < 0.5`
- **THEN** the minor grid line strokes are skipped

#### Scenario: Major grid hidden at sub-stroke cell size

- **WHEN** `cellSizeMM < 0.3`
- **THEN** the major grid line strokes are skipped

#### Scenario: User-line stroke clamped to cell size

- **WHEN** `cellSizeMM < 0.4 / 0.9 ≈ 0.444`
- **THEN** the line width passed to `pdf.setLineWidth` for user lines is
  `cellSizeMM × 0.9`, never exceeding the prior default of `0.4 mm`
- **AND** at larger cell sizes the line width remains the prior default
  `0.4 mm`

#### Scenario: Regression — pre-change valid range unchanged

- **GIVEN** any `cellsPerPage` from 1 to 100 inclusive in portrait
  (i.e. `cellSizeMM` from 182 down to 1.82)
- **WHEN** the PDF is generated
- **THEN** the resulting `jsPDF` call sequence (counts and arguments of
  `pdf.text`, `pdf.line`, `pdf.rect`, `pdf.addPage`, `pdf.setLineWidth`)
  is byte-identical to the pre-change generator

### Requirement: Print Output Session-Only

The system SHALL keep `cellsPerPageX` and `orientation` as
component-local React state — they SHALL NOT be persisted to
localStorage and SHALL NOT survive a page reload.

#### Scenario: Reload resets print settings

- **GIVEN** the user changed `cellsPerPageX` and `orientation` during a
  session
- **WHEN** the page is reloaded
- **THEN** `cellsPerPageX` is `25` and `orientation` is `portrait`

#### Scenario: No localStorage migration

- **GIVEN** any pre-change `weaving-scheme-storage` snapshot
- **WHEN** the post-change build hydrates
- **THEN** the resulting state is identical to the pre-change result;
  no print-related fields are read from or written to localStorage
