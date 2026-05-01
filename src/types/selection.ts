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
 * Which transform produced the active ghost.
 */
export type GhostKind = 'move' | 'paste' | 'mirror';

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
