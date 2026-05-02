import type { Line } from './line';

/**
 * Active pointer-input tool. Determines how canvas drag is interpreted.
 * - `draw`: existing behavior (toggle line on click, Shift = extend, Ctrl = flood)
 * - `select-rect`: drag draws a rectangular selection
 * - `select-lasso`: drag draws a free polygon selection
 */
export type Tool = 'draw' | 'select-rect' | 'select-lasso';

/**
 * How a new selection-drag combines with existing selection.
 * On desktop the modifier keys override this temporarily; on touch this is
 * the only control.
 */
export type RefineMode = 'replace' | 'add' | 'subtract';

/**
 * Set of selected cells, keyed by `${cellX}-${cellY}`.
 * Lines are NOT stored here — they are derived via `getLinesInMask`
 * with inclusive-boundary semantics.
 */
export type SelectionMask = Set<string>;

/**
 * Mirror axis. Either a horizontal grid line at row boundary `y`
 * (any `y ∈ [0..height]`) or a vertical grid line at column boundary `x`
 * (any `x ∈ [0..width]`). May be a half-integer for bbox-center presets.
 */
export type MirrorAxis =
  | { orientation: 'horizontal'; y: number }
  | { orientation: 'vertical'; x: number };

/**
 * Two ghost flavors. Note: individual transforms (flip, mirror, rotate)
 * are NOT separate kinds — they compose onto an existing ghost in place.
 *
 * - `'move'`: ghost has a `sourceMask`; on commit the source lines are
 *   removed and the ghost lines are added in one undoable transaction.
 *   Move, mirror, rotate, and any composition of those use this kind.
 * - `'paste'`: ghost has no `sourceMask`; on commit the lines are simply
 *   added (no removal).
 */
export type GhostKind = 'move' | 'paste';

/**
 * 90° rotation direction in screen coordinates (y-down).
 * `cw` = visual clockwise; `ccw` = visual counter-clockwise.
 */
export type RotationDirection = 'cw' | 'ccw';

/**
 * Floating pre-commit preview state. The `lines` array already has the
 * transform applied — adjustments mutate it directly rather than
 * accumulating a separate transform.
 */
export interface GhostState {
  kind: GhostKind;
  /** Lines as they would land on commit. */
  lines: Line[];
  /**
   * Cells whose lines are removed on commit (inclusive boundary).
   * Null for `paste` (pasting does not remove anything).
   */
  sourceMask: SelectionMask | null;
  /**
   * Cell mask the selection becomes after commit. Updated alongside `lines`
   * on every adjustment so the selection follows the operation.
   */
  destMask: SelectionMask;
}

/**
 * Session clipboard entry. Coordinates are normalized so the bbox top-left
 * is at (0, 0) — paste re-positions to a target offset.
 */
export interface ClipboardEntry {
  lines: Line[];
  bbox: {
    width: number;
    height: number;
  };
}
