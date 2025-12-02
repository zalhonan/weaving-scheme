import { create } from 'zustand';
import { VIEWPORT_LIMITS } from '../types/viewport';

interface ViewportStore {
  offsetX: number;
  offsetY: number;
  cellSize: number;

  pan: (deltaX: number, deltaY: number) => void;
  zoom: (delta: number, cursorX: number, cursorY: number) => void;
  reset: () => void;
}

export const useViewportStore = create<ViewportStore>((set, get) => ({
  offsetX: 0,
  offsetY: 0,
  cellSize: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,

  pan: (deltaX, deltaY) => {
    set((state) => ({
      offsetX: state.offsetX + deltaX,
      offsetY: state.offsetY + deltaY,
    }));
  },

  zoom: (delta, cursorX, cursorY) => {
    const { cellSize, offsetX, offsetY } = get();
    const newCellSize = Math.max(
      VIEWPORT_LIMITS.MIN_CELL_SIZE,
      Math.min(VIEWPORT_LIMITS.MAX_CELL_SIZE, cellSize + delta)
    );

    if (newCellSize === cellSize) return;

    // Zoom relative to cursor position
    const scale = newCellSize / cellSize;
    set({
      cellSize: newCellSize,
      offsetX: cursorX - (cursorX - offsetX) * scale,
      offsetY: cursorY - (cursorY - offsetY) * scale,
    });
  },

  reset: () =>
    set({
      offsetX: 0,
      offsetY: 0,
      cellSize: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,
    }),
}));
