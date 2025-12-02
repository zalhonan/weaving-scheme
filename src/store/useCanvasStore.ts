import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Line, LineOrientation, getLineKey, CellHighlight, CanvasStatistics, BoundingBox } from '../types';
import { mapReplacer, mapReviver } from '../utils/storage';
import { DEFAULT_COLOR, getPaleColor } from '../constants/colors';
import { CANVAS_DEFAULTS } from '../types/viewport';

interface CanvasState {
  width: number;
  height: number;
  lines: Map<string, Line>;
  highlights: CellHighlight[];
  currentColor: string;
}

interface CanvasActions {
  addLine: (x: number, y: number, orientation: LineOrientation) => void;
  removeLine: (x: number, y: number, orientation: LineOrientation) => void;
  toggleLine: (x: number, y: number, orientation: LineOrientation) => void;
  setCurrentColor: (color: string) => void;
  reset: () => void;
  getStatistics: () => CanvasStatistics;
  hasLine: (x: number, y: number, orientation: LineOrientation) => boolean;
  getCellHighlightColor: (cellX: number, cellY: number) => string | null;
  resizeCanvas: (side: 'top' | 'bottom' | 'left' | 'right' | 'all', delta: number) => void;
  setCanvasSize: (newWidth: number, newHeight: number) => void;
  addMultipleLines: (lines: Array<{ x: number; y: number; orientation: LineOrientation }>) => void;
  removeMultipleLines: (lines: Array<{ x: number; y: number; orientation: LineOrientation }>) => void;
  setRowHighlight: (index: number) => void;
  setColHighlight: (index: number) => void;
  removeRowHighlight: (index: number) => void;
  removeColHighlight: (index: number) => void;
  loadScheme: (data: { width: number; height: number; lines: Map<string, Line>; highlights: CellHighlight[]; currentColor: string }) => void;
}

type CanvasStore = CanvasState & CanvasActions;

const initialState: CanvasState = {
  width: CANVAS_DEFAULTS.WIDTH,
  height: CANVAS_DEFAULTS.HEIGHT,
  lines: new Map(),
  highlights: [],
  currentColor: DEFAULT_COLOR,
};

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    persist(
      (set, get) => ({
        ...initialState,

        addLine: (x, y, orientation) => {
          const key = getLineKey(x, y, orientation);
          set((state) => {
            const newLines = new Map(state.lines);
            if (!newLines.has(key)) {
              newLines.set(key, { x, y, orientation, color: state.currentColor });
            }
            return { lines: newLines };
          });
        },

        removeLine: (x, y, orientation) => {
          const key = getLineKey(x, y, orientation);
          set((state) => {
            const newLines = new Map(state.lines);
            newLines.delete(key);
            return { lines: newLines };
          });
        },

        toggleLine: (x, y, orientation) => {
          const key = getLineKey(x, y, orientation);
          const { lines, currentColor } = get();
          if (lines.has(key)) {
            // Already exists - recolor if different color
            const existingLine = lines.get(key)!;
            if (existingLine.color !== currentColor) {
              set((state) => {
                const newLines = new Map(state.lines);
                newLines.set(key, { x, y, orientation, color: currentColor });
                return { lines: newLines };
              });
            }
            return;
          }
          set((state) => {
            const newLines = new Map(state.lines);
            newLines.set(key, { x, y, orientation, color: currentColor });
            return { lines: newLines };
          });
        },

        setCurrentColor: (color) => set({ currentColor: color }),

        reset: () =>
          set({
            lines: new Map(),
            highlights: [],
          }),

        getStatistics: () => {
          const { width, height, lines } = get();
          let minX = Infinity,
            maxX = -Infinity;
          let minY = Infinity,
            maxY = -Infinity;
          let horizontalCount = 0,
            verticalCount = 0;

          lines.forEach((line) => {
            if (line.orientation === 'horizontal') {
              horizontalCount++;
              minX = Math.min(minX, line.x);
              maxX = Math.max(maxX, line.x);
              minY = Math.min(minY, line.y);
              maxY = Math.max(maxY, line.y);
            } else {
              verticalCount++;
              minX = Math.min(minX, line.x);
              maxX = Math.max(maxX, line.x);
              minY = Math.min(minY, line.y);
              maxY = Math.max(maxY, line.y);
            }
          });

          const boundingBox: BoundingBox | null =
            lines.size > 0 ? { minX, maxX, minY, maxY } : null;

          return {
            size: { width, height },
            boundingBox,
            horizontalLineCount: horizontalCount,
            verticalLineCount: verticalCount,
            totalLineCount: lines.size,
          };
        },

        hasLine: (x, y, orientation) => {
          const key = getLineKey(x, y, orientation);
          return get().lines.has(key);
        },

        getCellHighlightColor: (cellX, cellY) => {
          const { highlights } = get();
          const affecting = highlights.filter(
            (h) =>
              (h.type === 'row' && h.index === cellY) ||
              (h.type === 'col' && h.index === cellX)
          );
          if (affecting.length === 0) return null;
          return affecting.reduce((a, b) =>
            a.timestamp > b.timestamp ? a : b
          ).color;
        },

        resizeCanvas: (side, delta) => {
          const { width, height, lines } = get();
          const newLines = new Map<string, Line>();

          if (side === 'top') {
            const newHeight = Math.max(1, height + delta);
            if (delta > 0) {
              // Expanding top - shift all lines down
              lines.forEach((line) => {
                const newY = line.y + delta;
                const key = getLineKey(line.x, newY, line.orientation);
                newLines.set(key, { ...line, y: newY });
              });
            } else {
              // Shrinking top - remove lines in removed area and shift up
              lines.forEach((line) => {
                const newY = line.y + delta;
                if (newY >= 0 && (line.orientation === 'vertical' ? newY < newHeight : newY <= newHeight)) {
                  const key = getLineKey(line.x, newY, line.orientation);
                  newLines.set(key, { ...line, y: newY });
                }
              });
            }
            set({ height: newHeight, lines: newLines });
          } else if (side === 'bottom') {
            const newHeight = Math.max(1, height + delta);
            // Keep lines that fit in new size
            lines.forEach((line) => {
              if (line.orientation === 'vertical' ? line.y < newHeight : line.y <= newHeight) {
                const key = getLineKey(line.x, line.y, line.orientation);
                newLines.set(key, line);
              }
            });
            set({ height: newHeight, lines: newLines });
          } else if (side === 'left') {
            const newWidth = Math.max(1, width + delta);
            if (delta > 0) {
              // Expanding left - shift all lines right
              lines.forEach((line) => {
                const newX = line.x + delta;
                const key = getLineKey(newX, line.y, line.orientation);
                newLines.set(key, { ...line, x: newX });
              });
            } else {
              // Shrinking left - remove lines in removed area and shift left
              lines.forEach((line) => {
                const newX = line.x + delta;
                if (newX >= 0 && (line.orientation === 'horizontal' ? newX < newWidth : newX <= newWidth)) {
                  const key = getLineKey(newX, line.y, line.orientation);
                  newLines.set(key, { ...line, x: newX });
                }
              });
            }
            set({ width: newWidth, lines: newLines });
          } else if (side === 'right') {
            const newWidth = Math.max(1, width + delta);
            // Keep lines that fit in new size
            lines.forEach((line) => {
              if (line.orientation === 'horizontal' ? line.x < newWidth : line.x <= newWidth) {
                const key = getLineKey(line.x, line.y, line.orientation);
                newLines.set(key, line);
              }
            });
            set({ width: newWidth, lines: newLines });
          } else if (side === 'all') {
            // Expand/shrink from all sides
            const newWidth = Math.max(1, width + delta * 2);
            const newHeight = Math.max(1, height + delta * 2);
            if (delta > 0) {
              // Expanding - shift all lines
              lines.forEach((line) => {
                const newX = line.x + delta;
                const newY = line.y + delta;
                const key = getLineKey(newX, newY, line.orientation);
                newLines.set(key, { ...line, x: newX, y: newY });
              });
            } else {
              // Shrinking - remove lines outside and shift
              lines.forEach((line) => {
                const newX = line.x + delta;
                const newY = line.y + delta;
                const validX = line.orientation === 'horizontal' ? newX >= 0 && newX < newWidth : newX >= 0 && newX <= newWidth;
                const validY = line.orientation === 'vertical' ? newY >= 0 && newY < newHeight : newY >= 0 && newY <= newHeight;
                if (validX && validY) {
                  const key = getLineKey(newX, newY, line.orientation);
                  newLines.set(key, { ...line, x: newX, y: newY });
                }
              });
            }
            set({ width: newWidth, height: newHeight, lines: newLines });
          }
        },

        setCanvasSize: (newWidth, newHeight) => {
          const { width, height, lines } = get();
          const clampedWidth = Math.max(1, newWidth);
          const clampedHeight = Math.max(1, newHeight);

          if (clampedWidth === width && clampedHeight === height) return;

          const newLines = new Map<string, Line>();

          // Calculate offsets to center the drawing
          const deltaX = Math.floor((clampedWidth - width) / 2);
          const deltaY = Math.floor((clampedHeight - height) / 2);

          lines.forEach((line) => {
            const shiftedX = line.x + deltaX;
            const shiftedY = line.y + deltaY;

            // Check if the shifted line is within bounds
            const validX =
              line.orientation === 'horizontal'
                ? shiftedX >= 0 && shiftedX < clampedWidth
                : shiftedX >= 0 && shiftedX <= clampedWidth;
            const validY =
              line.orientation === 'vertical'
                ? shiftedY >= 0 && shiftedY < clampedHeight
                : shiftedY >= 0 && shiftedY <= clampedHeight;

            if (validX && validY) {
              const key = getLineKey(shiftedX, shiftedY, line.orientation);
              newLines.set(key, { ...line, x: shiftedX, y: shiftedY });
            }
          });

          set({ width: clampedWidth, height: clampedHeight, lines: newLines });
        },

        addMultipleLines: (linesToAdd) => {
          set((state) => {
            const newLines = new Map(state.lines);
            for (const { x, y, orientation } of linesToAdd) {
              const key = getLineKey(x, y, orientation);
              // Always set line with current color (recolor if exists)
              newLines.set(key, { x, y, orientation, color: state.currentColor });
            }
            return { lines: newLines };
          });
        },

        removeMultipleLines: (linesToRemove) => {
          set((state) => {
            const newLines = new Map(state.lines);
            for (const { x, y, orientation } of linesToRemove) {
              const key = getLineKey(x, y, orientation);
              newLines.delete(key);
            }
            return { lines: newLines };
          });
        },

        setRowHighlight: (index) => {
          const { currentColor, highlights } = get();
          const paleColor = getPaleColor(currentColor);
          const timestamp = Date.now();

          // Remove existing highlight for this row, then add new one
          const filtered = highlights.filter(
            (h) => !(h.type === 'row' && h.index === index)
          );
          set({
            highlights: [...filtered, { type: 'row', index, color: paleColor, timestamp }],
          });
        },

        setColHighlight: (index) => {
          const { currentColor, highlights } = get();
          const paleColor = getPaleColor(currentColor);
          const timestamp = Date.now();

          // Remove existing highlight for this column, then add new one
          const filtered = highlights.filter(
            (h) => !(h.type === 'col' && h.index === index)
          );
          set({
            highlights: [...filtered, { type: 'col', index, color: paleColor, timestamp }],
          });
        },

        removeRowHighlight: (index) => {
          set((state) => ({
            highlights: state.highlights.filter(
              (h) => !(h.type === 'row' && h.index === index)
            ),
          }));
        },

        removeColHighlight: (index) => {
          set((state) => ({
            highlights: state.highlights.filter(
              (h) => !(h.type === 'col' && h.index === index)
            ),
          }));
        },

        loadScheme: (data) => {
          set({
            width: data.width,
            height: data.height,
            lines: data.lines,
            highlights: data.highlights,
            currentColor: data.currentColor,
          });
        },
      }),
      {
        name: 'weaving-scheme-storage',
        storage: createJSONStorage(() => localStorage, {
          reviver: mapReviver,
          replacer: mapReplacer,
        }),
        partialize: (state) => ({
          width: state.width,
          height: state.height,
          lines: state.lines,
          highlights: state.highlights,
          currentColor: state.currentColor,
        }),
      }
    ),
    {
      limit: 100,
      equality: (pastState, currentState) => {
        return (
          JSON.stringify(pastState, mapReplacer) ===
          JSON.stringify(currentState, mapReplacer)
        );
      },
    }
  )
);

// Export temporal store hook for undo/redo
export const useTemporalStore = useCanvasStore.temporal;
