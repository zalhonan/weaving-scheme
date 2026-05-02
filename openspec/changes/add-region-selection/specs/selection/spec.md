# selection

The selection capability allows the user to mark a region of the pattern
(via rectangle or lasso) and apply structural transforms to it: move,
delete, copy / cut / paste, and mirror.

## ADDED Requirements

### Requirement: Tool Mode

The system SHALL provide a tool-mode setting with values
`draw`, `select-rect`, and `select-lasso` that determines how canvas
pointer input is interpreted.

#### Scenario: Switch to a selection tool

- **WHEN** the user activates a selection tool from the sidebar, the mobile
  toolbar, or a keyboard shortcut
- **THEN** subsequent left-button or single-finger drags create a selection
  region instead of drawing lines
- **AND** any in-progress drag from the previous tool is cancelled
- **AND** modifier-key behaviors of `draw` mode (line extension, flood fill)
  are no longer triggered

#### Scenario: Switch back to draw

- **WHEN** the user activates the draw tool
- **THEN** any active selection, ghost, or axis-picker state is cleared
- **AND** modifier-key behaviors of `draw` mode resume

### Requirement: Rectangle Selection

The system SHALL allow drawing a rectangular selection region by drag
in the `select-rect` tool.

#### Scenario: Draw rectangle (mouse)

- **WHEN** the user presses the left mouse button on a cell in `select-rect`
  mode and drags to another cell
- **THEN** all cells in the rectangular bounding box become the selection
- **AND** marching-ants animation appears around the region on release

#### Scenario: Draw rectangle (touch)

- **WHEN** the user touches a cell in `select-rect` mode and drags to another
  cell
- **THEN** the selection rectangle updates in real time as the finger moves
- **AND** the selection commits on finger lift

#### Scenario: Refinement — add (mouse)

- **WHEN** the user holds `Shift` and drags a rectangle in `select-rect` mode
- **AND** a selection already exists
- **THEN** the new rectangle is unioned with the existing selection

#### Scenario: Refinement — subtract (mouse)

- **WHEN** the user holds `Ctrl` (or `Cmd` on macOS) and drags a rectangle
  in `select-rect` mode
- **AND** a selection already exists
- **THEN** the new rectangle is subtracted from the existing selection

#### Scenario: Refinement (touch)

- **WHEN** the user has set the mobile toolbar refinement mode to `Add` or
  `Subtract`
- **AND** drags a rectangle
- **THEN** the rectangle is unioned with or subtracted from the existing
  selection accordingly

### Requirement: Lasso Selection

The system SHALL allow drawing a free-form polygon selection by drag in
the `select-lasso` tool.

#### Scenario: Draw lasso (mouse)

- **WHEN** the user holds the left mouse button and drags a path in
  `select-lasso` mode
- **THEN** new points are appended to the polygon only when their screen
  distance from the previous accepted point is at least 5 px
- **AND** on release the polygon closes and all cells whose centers fall
  inside the polygon become the selection

#### Scenario: Draw lasso (touch)

- **WHEN** the user drags a path with one finger in `select-lasso` mode
- **THEN** the same min-distance smoothing applies
- **AND** the selection commits on finger lift

#### Scenario: Lasso refinement — add (mouse)

- **WHEN** the user holds `Shift` and drags a lasso path
- **AND** a selection already exists
- **THEN** the lasso polygon is unioned with the existing selection

#### Scenario: Lasso refinement — subtract (mouse)

- **WHEN** the user holds `Ctrl` (or `Cmd` on macOS) and drags a lasso path
- **AND** a selection already exists
- **THEN** the lasso polygon is subtracted from the existing selection

### Requirement: Hybrid Selection Model with Inclusive Boundary

The system SHALL treat the selection as a set of cells, and SHALL derive
the affected lines using an inclusive-boundary rule: a horizontal line at
`(x, y)` belongs to the selection iff cell `(x, y-1)` OR cell `(x, y)` is
in the mask; a vertical line at `(x, y)` belongs iff cell `(x-1, y)` OR
cell `(x, y)` is in the mask.

#### Scenario: Boundary line included

- **GIVEN** a 2×2 cell selection at cells `{(1,1), (2,1), (1,2), (2,2)}`
- **WHEN** the system computes derived lines
- **THEN** horizontal lines on row boundaries `y=1` and `y=3` are included
  (top and bottom edges of the region)
- **AND** vertical lines on column boundaries `x=1` and `x=3` are included
  (left and right edges of the region)

#### Scenario: Line on perimeter of disconnected mask

- **GIVEN** a selection of two non-adjacent cells `{(0,0), (5,5)}`
- **WHEN** the system computes derived lines
- **THEN** all four edges of cell `(0,0)` and all four edges of cell `(5,5)`
  are included
- **AND** no other lines are included

### Requirement: Selection Visualization

The system SHALL render a marching-ants animation around the boundary of
the active selection.

#### Scenario: Animation

- **WHEN** a selection is active
- **THEN** the boundary is drawn as a dashed line whose dash offset advances
  by 0.5 px per frame
- **AND** dashes alternate visible and transparent for legibility on any
  background

#### Scenario: Performance — overlay canvas

- **WHEN** marching-ants animation is running
- **THEN** only the overlay canvas redraws each frame
- **AND** the static canvas (grid, lines, cell highlights, headers) does not
  redraw at the animation rate

#### Scenario: Animation lifecycle

- **WHEN** there is no active selection, ghost, or axis-picker
- **THEN** the overlay-canvas RAF loop is not running

### Requirement: Move

The system SHALL allow moving the selected region by drag-and-drop or by
arrow-key cell-by-cell nudge, with a floating ghost preview before commit.

#### Scenario: Move via drag (mouse)

- **WHEN** the user drags inside the selection bbox while a selection is
  active and no other operation is in progress
- **THEN** a floating layer containing the selected lines appears and follows
  the cursor offset
- **AND** the source lines are hidden from the static canvas (the source
  area renders as empty canvas) for the duration of the operation
- **AND** the marching-ants outline tracks the floating layer (no outline
  remains at the source)

#### Scenario: Move via arrow keys

- **WHEN** the user presses an arrow key while a selection is active
- **THEN** if no ghost exists yet, a move-ghost is created at offset (0,0)
- **AND** the ghost shifts by 1 cell in the corresponding direction (clamped
  to canvas bounds)

#### Scenario: Move via touch

- **WHEN** the user touches inside the selection bbox in a select tool and
  drags
- **THEN** a ghost appears at the touch offset
- **AND** lifting the finger does NOT auto-commit; commit requires the
  Confirm button

#### Scenario: Move via mobile arrow buttons

- **WHEN** a move-ghost is active and the user taps an arrow button in the
  mobile toolbar
- **THEN** the ghost shifts by 1 cell in that direction (clamped to canvas
  bounds)

#### Scenario: Commit move

- **WHEN** the user presses `Enter` or clicks/taps the Confirm button
- **THEN** the original lines belonging to the source mask are removed
- **AND** the ghost lines are written to the canvas
- **AND** the operation is one undoable transaction in `useCanvasStore`
- **AND** the selection mask becomes the destination cell set (translated)

#### Scenario: Cancel move

- **WHEN** the user presses `Escape` or taps the Cancel button
- **THEN** the ghost is discarded
- **AND** the canvas is unchanged
- **AND** the selection is restored to its pre-move state

### Requirement: Delete

The system SHALL remove all derived lines (inclusive boundary) belonging
to the selection on a delete command.

#### Scenario: Delete via keyboard

- **WHEN** the user presses `Delete` or `Backspace` while a selection is
  active and no ghost exists
- **THEN** all derived lines for the selection are removed in one undoable
  transaction
- **AND** the selection itself is cleared
- **AND** `CellHighlight` row/column overlays inside the selection are NOT
  affected

#### Scenario: Delete via toolbar

- **WHEN** the user clicks/taps the Delete button while a selection is active
- **THEN** the same behavior occurs

### Requirement: Copy and Cut

The system SHALL support copying or cutting the selected pattern lines
into a session clipboard.

#### Scenario: Copy

- **WHEN** the user presses `Ctrl+C` (`Cmd+C` on macOS) or clicks the Copy
  button while a selection is active
- **THEN** the derived lines are stored in `useSelectionStore.clipboard`,
  with coordinates normalized so the bbox top-left becomes `(0, 0)`
- **AND** the canvas and the selection are unchanged

#### Scenario: Cut

- **WHEN** the user presses `Ctrl+X` (`Cmd+X` on macOS) or clicks the Cut
  button while a selection is active
- **THEN** the derived lines are stored in the clipboard (normalized)
- **AND** the lines are removed from the canvas in one undoable transaction
- **AND** the selection is cleared

#### Scenario: Clipboard persistence across reloads

- **WHEN** the user reloads the page
- **THEN** the clipboard is restored from localStorage if a previous
  copy or cut wrote to it during any earlier session

#### Scenario: Clipboard sync across tabs

- **WHEN** the user copies or cuts in one tab of the editor
- **AND** another tab of the same origin has the editor open
- **THEN** the second tab receives the new clipboard via the `storage`
  event and reflects it in the UI (the Paste button appears or updates),
  enabling cross-window paste of pattern fragments between two open
  editor instances

#### Scenario: Clipboard cleared in one tab

- **WHEN** the clipboard storage entry is deleted in one tab (e.g. by
  manual clearing or a future reset action)
- **THEN** open tabs of the same origin receive the `storage` event with
  `newValue === null` and clear their in-memory clipboard accordingly

### Requirement: Paste

The system SHALL support pasting clipboard content as a floating ghost
that the user positions before commit.

#### Scenario: Paste

- **WHEN** the user presses `Ctrl+V` (`Cmd+V` on macOS) or clicks the Paste
  button and the clipboard is non-empty
- **THEN** a paste-ghost containing the clipboard lines appears, positioned
  with the following origin priority:
  1. an explicit cursor cell, if one is supplied by the caller, OR
  2. the top-left of the active selection's bbox, if a selection exists, OR
  3. (1, 1) from the canvas origin as a fallback
- **AND** the user can adjust the position via drag or arrow keys
  (or arrow buttons on touch)

#### Scenario: Paste with no clipboard

- **WHEN** the user invokes paste while the clipboard is empty
- **THEN** nothing happens (no ghost, no error)

#### Scenario: Commit paste

- **WHEN** the user confirms the ghost
- **THEN** ghost lines are written to the canvas in one undoable transaction
- **AND** the selection mask becomes the pasted cell set

#### Scenario: Cancel paste

- **WHEN** the user cancels the ghost
- **THEN** the ghost is discarded with no canvas change
- **AND** any selection that existed before paste remains unchanged

### Requirement: Mirror

The system SHALL support mirroring the selected pattern across an axis,
either chosen interactively (any horizontal or vertical grid line) or via
quick presets that mirror around the selection bbox center.

#### Scenario: Quick Flip-H

- **WHEN** the user invokes "Flip H" while a selection is active
- **THEN** a mirror-ghost is created with the axis at the bbox vertical
  center (`bbox.minX + bbox.width / 2`)
- **AND** the ghost is adjustable like any other ghost

#### Scenario: Quick Flip-V

- **WHEN** the user invokes "Flip V" while a selection is active
- **THEN** a mirror-ghost is created with the axis at the bbox horizontal
  center (`bbox.minY + bbox.height / 2`)

#### Scenario: Mirror with custom axis

- **WHEN** the user invokes "Mirror" while a selection is active
- **THEN** the system enters axis-picker mode (`axisPicker.active = true`)
- **AND** the cursor changes to crosshair
- **AND** pointer-move highlights the nearest grid line within proximity
  threshold on the overlay canvas

#### Scenario: Set axis

- **WHEN** the user clicks a horizontal or vertical grid line during
  axis-picker mode
- **THEN** the axis is set
- **AND** axis-picker mode exits
- **AND** a mirror-ghost is created using the chosen axis

#### Scenario: Mirror commit

- **WHEN** the user confirms a mirror-ghost
- **THEN** the original lines belonging to the source mask are removed
- **AND** the mirrored lines are written
- **AND** the operation is one undoable transaction
- **AND** the selection mask becomes the mirrored cell set

#### Scenario: Mirror preserves orientation

- **WHEN** any mirror operation is computed
- **THEN** horizontal lines stay horizontal and vertical lines stay vertical
- **AND** only the position component (x for vertical-axis mirror, y for
  horizontal-axis mirror) is reflected

### Requirement: Floating Layer Mechanic

The system SHALL render a floating layer during move, paste, and mirror
operations, supporting position adjustment before commit and atomic
commit/cancel semantics. The model is image-editor-style: source content
is hidden during the operation and the floating layer is rendered at full
opacity at its current position, so the user sees the moved content as if
it were "lifted" off the canvas.

#### Scenario: Floating layer rendering

- **WHEN** any transform operation is in progress (`ghost !== null`)
- **THEN** the floating layer lines are rendered on the overlay canvas at
  full opacity, matching the visual weight of committed lines
- **AND** for move and mirror, the source lines are hidden from the static
  canvas — rendered as empty canvas at the source — for the duration of
  the operation
- **AND** no source is rendered for paste (paste has no source)
- **AND** the marching-ants outline tracks the floating layer's destination
  mask, never the original selection mask

#### Scenario: Ghost adjustment

- **WHEN** a ghost is active
- **AND** the user drags within the ghost bbox or presses an arrow key
- **THEN** `ghost.lines` are translated by the delta in cells
- **AND** the ghost bbox is clamped to remain within `[0, width] × [0, height]`

#### Scenario: Ghost commit triggers

- **WHEN** the user presses `Enter`
- **OR** clicks/taps outside the ghost bbox (desktop only)
- **OR** taps the Confirm button
- **THEN** the ghost is committed via the appropriate `applyMove` /
  `applyPaste` / `applyMirror` action — one undoable transaction — and
  cleared

#### Scenario: Ghost cancel triggers

- **WHEN** the user presses `Escape` or taps the Cancel button
- **THEN** the floating layer is discarded without any canvas mutation
- **AND** for move and mirror, the source lines reappear on the static
  canvas (the canvas store was never modified — the source was only
  visually hidden during the operation)
- **AND** the pre-operation selection is restored at the source

#### Scenario: Tool switch cancels ghost

- **WHEN** a ghost is active and the user changes tool
- **THEN** the ghost is cancelled (canvas unchanged) and the selection is
  cleared

### Requirement: CellHighlights Excluded

Selection operations SHALL NOT include `CellHighlight` row/column overlays.
Move, copy, cut, paste, mirror, and delete operate exclusively on `Line`
instances.

#### Scenario: Highlight unaffected by move

- **GIVEN** a selection includes cells covered by a row highlight
- **WHEN** the user moves the selection
- **THEN** the row highlight remains in place — it does not move with the
  selection

#### Scenario: Highlight unaffected by delete

- **GIVEN** a selection includes cells covered by a column highlight
- **WHEN** the user deletes the selection
- **THEN** the column highlight remains visible

### Requirement: Undo Redo Coverage and Keyboard

The system SHALL record every canvas-mutating selection operation (move,
delete, cut, paste, mirror) as one entry in the shared
`useCanvasStore.temporal` history, alongside ordinary draw/erase entries,
and SHALL expose undo/redo via both the sidebar buttons AND the standard
keyboard shortcuts `Ctrl+Z` / `Cmd+Z` (undo) and `Ctrl+Shift+Z` /
`Cmd+Shift+Z` / `Ctrl+Y` / `Cmd+Y` (redo). Both entry points SHALL clear
`selection`, `ghost`, and `axisPicker` after advancing the temporal cursor,
preventing orphaned UI state on a transformed canvas.

#### Scenario: Operations are recorded in the shared history

- **WHEN** the user commits a move, delete, cut, paste, or mirror
- **THEN** exactly one entry is added to `useCanvasStore.temporal`'s
  past states
- **AND** that entry sits alongside ordinary draw/erase entries in the
  same history stream

#### Scenario: Undo via keyboard

- **WHEN** the user presses `Ctrl+Z` (`Cmd+Z` on macOS) and the focus is
  not inside an input/textarea/contenteditable
- **THEN** `useCanvasStore.temporal.undo()` is invoked
- **AND** any active `selection`, `ghost`, or `axisPicker` is cleared

#### Scenario: Redo via keyboard

- **WHEN** the user presses `Ctrl+Shift+Z`, `Cmd+Shift+Z`, `Ctrl+Y`, or
  `Cmd+Y` outside an input
- **THEN** `useCanvasStore.temporal.redo()` is invoked
- **AND** any active `selection`, `ghost`, or `axisPicker` is cleared

#### Scenario: Undo via sidebar button

- **WHEN** the user clicks the sidebar Undo button
- **THEN** the same behavior occurs as the keyboard path (temporal undo
  + selection clear)

#### Scenario: Selection state itself is not undoable

- **WHEN** the user creates, refines, or clears a selection (without
  committing a transform)
- **THEN** these changes do NOT add an entry to the temporal history
- **AND** undo skips them entirely

#### Scenario: Cancelling a ghost does not pollute history

- **WHEN** the user starts a move/mirror, optionally adjusts the ghost,
  then presses Escape
- **THEN** no entry is added to the temporal history (the canvas store
  was never modified — render-time hiding only)

### Requirement: Canvas Resize Clears Selection

The system SHALL clear the selection and any active ghost when the canvas
is resized (`resizeCanvas` or `setCanvasSize`), since cell coordinates may
shift or be removed.

#### Scenario: Resize clears

- **WHEN** the user resizes the canvas while a selection is active
- **THEN** the selection becomes `null`
- **AND** any active ghost is cleared

### Requirement: Touch Parity

All selection interactions SHALL be accessible via touch with no required
keyboard or pointer-modifier input.

#### Scenario: Tool switch on mobile

- **WHEN** the user taps a tool button in `MobileToolbar`
- **THEN** the tool changes accordingly

#### Scenario: Refinement on mobile

- **WHEN** a select tool is active
- **THEN** the mobile toolbar shows a tri-state toggle:
  `[Replace | Add | Subtract]`
- **AND** the toggle determines the refinement mode for the next drag

#### Scenario: Operations on mobile

- **WHEN** a selection is active
- **THEN** the mobile toolbar shows operation buttons: Move, Delete, Copy,
  Cut, Paste, Flip-H, Flip-V, Mirror

#### Scenario: Ghost controls on mobile

- **WHEN** a ghost is active
- **THEN** the mobile toolbar shows arrow-nudge buttons (↑ ↓ ← →) and
  Confirm / Cancel buttons
- **AND** ghost commit happens only on Confirm tap (never on finger lift)

#### Scenario: Long-press in select tool

- **WHEN** a select tool is active
- **AND** the user long-presses the canvas
- **THEN** the long-press does NOT trigger erase (which is the long-press
  behavior in the draw tool)
