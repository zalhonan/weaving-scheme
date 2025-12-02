export interface Viewport {
  offsetX: number;
  offsetY: number;
  cellSize: number;
}

export const VIEWPORT_LIMITS = {
  MIN_CELL_SIZE: 8,
  MAX_CELL_SIZE: 50,
  DEFAULT_CELL_SIZE: 25,
} as const;

export const CANVAS_DEFAULTS = {
  WIDTH: 20,
  HEIGHT: 20,
} as const;
