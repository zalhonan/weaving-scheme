import { create } from 'zustand';
import { VIEWPORT_LIMITS } from '../types/viewport';
import { CANVAS_CONSTANTS } from '../constants';
import { useCanvasStore } from './useCanvasStore';

const FIT_TO_VIEW_PADDING = 16;

interface ViewportStore {
  offsetX: number;
  offsetY: number;
  cellSize: number;

  pan: (deltaX: number, deltaY: number) => void;
  zoom: (factor: number, cursorX: number, cursorY: number) => void;
  fitToView: (viewportWidth: number, viewportHeight: number) => void;
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

  zoom: (factor, cursorX, cursorY) => {
    const { cellSize, offsetX, offsetY } = get();
    const newCellSize = Math.max(
      VIEWPORT_LIMITS.MIN_CELL_SIZE,
      Math.min(VIEWPORT_LIMITS.MAX_CELL_SIZE, cellSize * factor)
    );

    if (newCellSize === cellSize) return;

    // Zoom relative to cursor position. Anchor math is defined in terms of
    // the ratio scale = newCellSize / cellSize, so it works identically for
    // additive or multiplicative zoom contracts.
    const scale = newCellSize / cellSize;
    set({
      cellSize: newCellSize,
      offsetX: cursorX - (cursorX - offsetX) * scale,
      offsetY: cursorY - (cursorY - offsetY) * scale,
    });
  },

  fitToView: (viewportWidth, viewportHeight) => {
    const { width, height } = useCanvasStore.getState();
    const numberArea = CANVAS_CONSTANTS.NUMBER_AREA_WIDTH;
    const fitW =
      (viewportWidth - numberArea - FIT_TO_VIEW_PADDING * 2) / width;
    const fitH =
      (viewportHeight - numberArea - FIT_TO_VIEW_PADDING * 2) / height;
    // Never zoom *in* past default for a tiny canvas.
    const targetCellSize = Math.max(
      VIEWPORT_LIMITS.MIN_CELL_SIZE,
      Math.min(VIEWPORT_LIMITS.DEFAULT_CELL_SIZE, Math.min(fitW, fitH))
    );
    const gridPxW = width * targetCellSize;
    const gridPxH = height * targetCellSize;
    const offsetX = (viewportWidth - numberArea - gridPxW) / 2;
    const offsetY = (viewportHeight - numberArea - gridPxH) / 2;
    set({ cellSize: targetCellSize, offsetX, offsetY });
  },

  reset: () =>
    set({
      offsetX: 0,
      offsetY: 0,
      cellSize: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,
    }),
}));
