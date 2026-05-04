# viewport Specification Delta — infinite-zoom-out

## ADDED Requirements

### Requirement: Zoom Range

The system SHALL clamp the viewport `cellSize` to the inclusive range
`[0.5 px, 50 px]` per cell, with a default of `25 px`.

#### Scenario: Lower bound reached

- **GIVEN** the user keeps zooming out (mouse wheel down or pinch close)
- **WHEN** `cellSize` would otherwise drop below `0.5`
- **THEN** the system clamps `cellSize` to `0.5` and ignores further
  zoom-out input

#### Scenario: Upper bound reached

- **GIVEN** the user keeps zooming in
- **WHEN** `cellSize` would otherwise exceed `50`
- **THEN** the system clamps `cellSize` to `50` and ignores further
  zoom-in input

#### Scenario: Default at session start

- **WHEN** the application loads in a fresh session
- **THEN** `cellSize` is `25` and the viewport offset is `(0, 0)`

### Requirement: Multiplicative Zoom Step

The system SHALL apply a multiplicative factor to `cellSize` on each zoom
event, so that the percentage change per scroll tick or pinch frame is
constant regardless of current `cellSize`.

#### Scenario: Wheel up

- **WHEN** the user scrolls the wheel up by one tick over the canvas
- **THEN** `cellSize` is multiplied by approximately `1.08` (clamped to
  the upper bound)

#### Scenario: Wheel down

- **WHEN** the user scrolls the wheel down by one tick over the canvas
- **THEN** `cellSize` is multiplied by approximately `1 / 1.08` (clamped
  to the lower bound)

#### Scenario: Pinch zoom (touch)

- **WHEN** the user changes the distance between two touch points by
  ratio `r = current / initial` during a pinch gesture
- **THEN** `cellSize` is multiplied by `r` (clamped to bounds)
- **AND** the pinch midpoint is the cursor anchor

#### Scenario: Step size at default zoom matches legacy

- **GIVEN** `cellSize = 25` (default)
- **WHEN** the user scrolls the wheel one tick
- **THEN** the resulting `cellSize` is between `23` and `27` — the same
  ±2 felt step that existed before this change

### Requirement: Cursor-Anchored Zoom

The system SHALL preserve the world-space position under the cursor (or
pinch midpoint) when zoom changes — the cell beneath the input point at
the start of the zoom event SHALL remain beneath the input point at the
end of the zoom event.

#### Scenario: Wheel zoom over a specific cell

- **GIVEN** the user's cursor is over screen position `(sx, sy)` which
  maps to grid cell `(gx, gy)`
- **WHEN** the user scrolls the wheel
- **THEN** after the zoom step, screen position `(sx, sy)` still maps to
  grid cell `(gx, gy)` (within ±0.5 px tolerance from rounding)

#### Scenario: Pinch zoom on touch

- **GIVEN** two fingers down, midpoint at `(mx, my)` mapping to grid
  cell `(gx, gy)`
- **WHEN** the fingers spread or pinch
- **THEN** the grid cell beneath the midpoint after the zoom step is
  unchanged

### Requirement: Adaptive Rendering Profile

The system SHALL adjust which canvas layers are drawn based on the
current `cellSize`, so that the canvas remains visually coherent at
extreme zoom-out levels. Each layer SHALL be drawn unchanged at
`cellSize ≥ 8`; below stated thresholds, layers degrade or disappear.

#### Scenario: Numbers hidden at small cellSize

- **WHEN** `cellSize < 8`
- **THEN** column-number and row-number labels are not drawn
- **AND** at `cellSize ≥ 8` they are drawn exactly as before this change

#### Scenario: Tails hidden at small cellSize

- **WHEN** `cellSize < 4`
- **THEN** the row and column "tails" (clickable line extensions) are
  not drawn
- **AND** at `cellSize ≥ 4` tails are drawn at the existing
  `cellSize × 0.5` length

#### Scenario: Minor grid hidden at very small cellSize

- **WHEN** `cellSize < 2.5`
- **THEN** the minor grid lines (every cell boundary) are not drawn
- **AND** at `cellSize ≥ 2.5` minor grid is drawn unchanged

#### Scenario: Major grid hidden at sub-cellSize strokes

- **WHEN** `cellSize < 1.5`
- **THEN** the major grid lines (every 10 cells) are not drawn

#### Scenario: User-line fallback rendering

- **WHEN** `cellSize < 1.5`
- **THEN** user lines are drawn as filled rectangles of size
  `max(1, cellSize) × max(1, cellSize)` centered on the cell edge,
  preserving each line's color
- **AND** at `cellSize ≥ 1.5` user lines are drawn as 2 px strokes,
  identical to the existing rendering

#### Scenario: Regression — high zoom unchanged

- **GIVEN** any `cellSize ≥ 8`
- **WHEN** the canvas renders
- **THEN** the resulting pixel output is identical to the pre-change
  renderer (no layer is degraded, no layer is added)

### Requirement: Viewport Culling

The system SHALL iterate only the cells, grid lines, tails, and user
lines that intersect the visible viewport, padded by one cell on each
edge.

#### Scenario: Off-screen cells skipped

- **GIVEN** a 1000×1000 grid at `cellSize = 2` with the viewport
  positioned so only a 200×200 region is visible
- **WHEN** the canvas renders one frame
- **THEN** the cell-highlight loop iterates roughly the visible region
  (within ±1 cell padding) — fewer than 50 000 iterations rather than
  1 000 000
- **AND** highlights, grid lines, tails, and user lines that fall
  inside the visible region appear identically to a non-culled render

#### Scenario: Boundary cells not clipped

- **GIVEN** any viewport position with fractional `offsetX` and `offsetY`
- **WHEN** the canvas renders
- **THEN** no visible-edge cell, grid line, or user line is missing
  due to off-by-one culling

### Requirement: Fit to View

The system SHALL provide a `fitToView` action that sets `cellSize` and
viewport offsets so that the entire grid (plus the number-label area)
is visible and centered in the rendered viewport.

#### Scenario: Fit a 1000×1000 grid

- **GIVEN** a 1000×1000 grid and a `1200×800` viewport
- **WHEN** the user activates `fitToView`
- **THEN** `cellSize` becomes the largest value such that
  `width × cellSize + numberArea + padding × 2 ≤ viewportWidth`
  and the same for height — clamped to `[0.5, DEFAULT_CELL_SIZE]`
- **AND** the grid is centered: equal pixel margins on left/right and
  top/bottom (within ±1 px from rounding)

#### Scenario: Fit a small grid does not zoom in past default

- **GIVEN** a 5×5 grid in a `1200×800` viewport
- **WHEN** the user activates `fitToView`
- **THEN** `cellSize` is `DEFAULT_CELL_SIZE` (25), not the larger value
  that would let the tiny grid fill the screen

#### Scenario: Sidebar button

- **WHEN** the user clicks the "Вписать в экран" button in the sidebar
- **THEN** `fitToView` runs with the canvas element's current
  `clientWidth` and `clientHeight`

#### Scenario: Keyboard shortcut

- **WHEN** the user presses `0` with no modifier and no input element
  focused
- **THEN** `fitToView` runs with the canvas element's current
  `clientWidth` and `clientHeight`

#### Scenario: Touch — sidebar entry

- **WHEN** a touch user opens the sidebar (☰) and taps "Вписать в экран"
- **THEN** `fitToView` runs identically to the desktop sidebar path

### Requirement: Viewport Session Persistence

The system SHALL keep all viewport state (`cellSize`, `offsetX`,
`offsetY`) session-only — viewport state SHALL NOT be persisted to
localStorage and SHALL NOT survive a page reload.

#### Scenario: Reload resets viewport

- **GIVEN** the user zoomed and panned the viewport during a session
- **WHEN** the page is reloaded
- **THEN** `cellSize` is the default (25), `offsetX` and `offsetY` are
  `0`
- **AND** the persisted scheme (lines, highlights, canvas size,
  current color) loads unchanged

#### Scenario: No localStorage migration required

- **GIVEN** a `weaving-scheme-storage` snapshot written by a
  pre-change build
- **WHEN** the post-change build hydrates the canvas store from that
  snapshot
- **THEN** the resulting state matches the pre-change result exactly
  (no fields added, removed, or transformed)
