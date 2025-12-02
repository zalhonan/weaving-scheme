# Application Architecture

**Stack:** React 18 + Vite + Zustand + TypeScript

---

## Project Structure

```
src/
|-- main.tsx                    # Application entry point
|-- App.tsx                     # Root component with layout
|-- index.css                   # Global styles
|
|-- components/
|   |-- Canvas/
|   |   |-- Canvas.tsx          # Main canvas component
|   |   |-- Canvas.module.css   # Canvas styles
|   |   |-- useCanvasRenderer.ts    # Canvas drawing hook
|   |   |-- useCanvasInteraction.ts # Mouse/keyboard events hook
|   |   +-- index.ts
|   |
|   |-- Sidebar/
|   |   |-- Sidebar.tsx         # Collapsible sidebar container
|   |   |-- Statistics.tsx      # Stats display (Epic 1)
|   |   |-- ResetButton.tsx     # Reset with confirmation (Epic 1)
|   |   |-- UndoRedo.tsx        # Undo/Redo buttons (Epic 2)
|   |   |-- CanvasResizer.tsx   # Canvas size controls (Epic 2)
|   |   |-- HotkeyInfo.tsx      # Collapsible hotkey list (Epic 2)
|   |   |-- ColorPicker.tsx     # Color selection (Epic 4)
|   |   |-- ExportImport.tsx    # JSON export/import (Epic 5)
|   |   |-- PrintButton.tsx     # PDF print (Epic 5)
|   |   +-- index.ts
|   |
|   |-- ui/
|   |   |-- Button.tsx
|   |   |-- Toast.tsx
|   |   |-- ConfirmDialog.tsx
|   |   +-- index.ts
|   |
|   +-- ErrorBoundary.tsx       # Error boundary for graceful failures
|
|-- store/
|   |-- useCanvasStore.ts       # Main Zustand store (lines, highlights)
|   |-- useViewportStore.ts     # Viewport state (zoom, pan)
|   |-- useUIStore.ts           # UI state (sidebar, toasts)
|   +-- types.ts                # Store-related types
|
|-- types/
|   |-- line.ts                 # Line model
|   |-- highlight.ts            # Cell highlight model
|   |-- canvas.ts               # Canvas state types
|   |-- viewport.ts             # Viewport types
|   +-- index.ts                # Re-exports
|
|-- utils/
|   |-- canvas/
|   |   |-- renderer.ts         # Canvas drawing functions
|   |   |-- hitTest.ts          # Click detection with tolerance
|   |   |-- coordinates.ts      # Screen <-> Grid coordinate conversion
|   |   |-- floodFill.ts        # Flood fill algorithm (Epic 3)
|   |   +-- lineExtend.ts       # Line extension algorithm (Epic 3)
|   |
|   |-- export/
|   |   |-- json.ts             # JSON serialization (Epic 5)
|   |   +-- pdf.ts              # PDF generation (Epic 5)
|   |
|   |-- colors.ts               # Color palette and pale color generator
|   +-- storage.ts              # Map serialization for localStorage
|
|-- hooks/
|   |-- useKeyboardShortcuts.ts # Global keyboard shortcuts
|   +-- usePreventContextMenu.ts
|
+-- constants/
    |-- canvas.ts               # Default sizes, limits
    |-- colors.ts               # 8-color palette
    +-- index.ts
```

---

## Data Models (TypeScript)

### Line Model

```typescript
// types/line.ts

export type LineOrientation = 'horizontal' | 'vertical';

/**
 * Line on the grid border.
 *
 * Coordinate system:
 * - Grid has cells [0..width-1] x [0..height-1]
 * - Horizontal lines are at row boundaries (y = 0 to height)
 * - Vertical lines are at column boundaries (x = 0 to width)
 *
 * For HORIZONTAL line at row boundary `y`:
 *   - `x` = column index (0 to width-1), identifies which cell's top/bottom border
 *   - `y` = row boundary (0 = top of row 0, height = bottom of last row)
 *
 * For VERTICAL line at column boundary `x`:
 *   - `x` = column boundary (0 = left of col 0, width = right of last col)
 *   - `y` = row index (0 to height-1), identifies which cell's left/right border
 *
 * Example for 3x3 grid:
 *   Horizontal line at top of cell (1,0): { x: 1, y: 0, orientation: 'horizontal' }
 *   Vertical line at left of cell (0,1): { x: 0, y: 1, orientation: 'vertical' }
 */
export interface Line {
  x: number;
  y: number;
  orientation: LineOrientation;
  color: string; // Hex color, e.g., '#000000'
}

// Unique key for Map storage
export const getLineKey = (x: number, y: number, orientation: LineOrientation): string =>
  `${orientation}-${x}-${y}`;

export const parseLineKey = (key: string): { x: number; y: number; orientation: LineOrientation } => {
  const [orientation, x, y] = key.split('-');
  return { orientation: orientation as LineOrientation, x: Number(x), y: Number(y) };
};
```

### Cell Highlight Model

```typescript
// types/highlight.ts

export type HighlightType = 'row' | 'col';

/**
 * Highlight for entire row or column of cells.
 * Applied via click on row/column number.
 *
 * Order matters: highlights are stored in application order.
 * On intersection of highlighted row and column, the LAST applied wins.
 */
export interface CellHighlight {
  type: HighlightType;
  index: number;         // Row or column index (0-based)
  color: string;         // Full color (will be rendered as pale version)
  timestamp: number;     // For determining "last applied" on intersections
}
```

### Canvas State Types

```typescript
// types/canvas.ts

import { Line } from './line';
import { CellHighlight } from './highlight';

export interface CanvasSize {
  width: number;   // Number of columns
  height: number;  // Number of rows
}

export interface CanvasStatistics {
  size: CanvasSize;
  boundingBox: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null;  // null if no lines
  horizontalLineCount: number;
  verticalLineCount: number;
  totalLineCount: number;
}

/**
 * Resize anchor determines how canvas grows/shrinks.
 * For "cross" UI: each direction can be adjusted independently.
 */
export interface ResizeDeltas {
  top: number;     // Positive = add rows at top, negative = remove
  bottom: number;  // Positive = add rows at bottom, negative = remove
  left: number;    // Positive = add cols at left, negative = remove
  right: number;   // Positive = add cols at right, negative = remove
}
```

### Viewport Model

```typescript
// types/viewport.ts

export interface Viewport {
  offsetX: number;   // Pan offset in pixels
  offsetY: number;
  cellSize: number;  // Pixels per cell (zoom level)
}

export const VIEWPORT_LIMITS = {
  MIN_CELL_SIZE: 8,   // Max zoom out
  MAX_CELL_SIZE: 50,  // Max zoom in
  DEFAULT_CELL_SIZE: 25,
} as const;

export const CANVAS_DEFAULTS = {
  WIDTH: 20,
  HEIGHT: 20,
} as const;
```

---

## State Management (Zustand)

### Main Canvas Store

```typescript
// store/useCanvasStore.ts

import { create } from 'zustand';
import { temporal } from 'zundo';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mapReplacer, mapReviver } from '../utils/storage';

interface CanvasStore {
  // === State ===
  width: number;
  height: number;
  lines: Map<string, Line>;
  highlights: CellHighlight[];
  currentColor: string;

  // === Line Actions ===
  addLine: (x: number, y: number, orientation: LineOrientation) => void;
  removeLine: (x: number, y: number, orientation: LineOrientation) => void;
  toggleLine: (x: number, y: number, orientation: LineOrientation) => void;

  // === Advanced Line Actions (Epic 3) ===
  extendLine: (x: number, y: number, orientation: LineOrientation) => boolean;
  floodFill: (cellX: number, cellY: number) => boolean;
  drawFullLine: (position: number, orientation: LineOrientation, draw: boolean) => void;

  // === Highlight Actions (Epic 4) ===
  addHighlight: (type: HighlightType, index: number) => void;
  removeHighlight: (type: HighlightType, index: number) => void;

  // === Color Actions ===
  setCurrentColor: (color: string) => void;
  recolorLine: (x: number, y: number, orientation: LineOrientation) => void;

  // === Canvas Actions ===
  resizeCanvas: (deltas: ResizeDeltas) => void;
  reset: () => void;

  // === Import/Export (Epic 5) ===
  exportToJSON: () => string;
  importFromJSON: (json: string) => boolean;

  // === Selectors ===
  getStatistics: () => CanvasStatistics;
  hasLine: (x: number, y: number, orientation: LineOrientation) => boolean;
  getCellHighlightColor: (cellX: number, cellY: number) => string | null;
}

export const useCanvasStore = create<CanvasStore>()(
  temporal(
    persist(
      (set, get) => ({
        // Initial state
        width: CANVAS_DEFAULTS.WIDTH,
        height: CANVAS_DEFAULTS.HEIGHT,
        lines: new Map(),
        highlights: [],
        currentColor: DEFAULT_COLOR,

        // Line actions
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

        // Toggle: add if missing, do nothing if exists (for left click)
        // For right click, use removeLine
        toggleLine: (x, y, orientation) => {
          const key = getLineKey(x, y, orientation);
          const { lines, currentColor } = get();
          if (lines.has(key)) return; // Don't remove on left click
          set((state) => {
            const newLines = new Map(state.lines);
            newLines.set(key, { x, y, orientation, color: currentColor });
            return { lines: newLines };
          });
        },

        // Extend line until hitting another line (Epic 3)
        extendLine: (x, y, orientation) => {
          // Returns true if line was extended, false if no boundary found
          // Implementation uses lineExtend utility
        },

        // Flood fill closed contour (Epic 3)
        floodFill: (cellX, cellY) => {
          // Returns true if filled, false if contour not closed
          // Implementation uses floodFill utility
        },

        // Draw/erase full row or column line (tail click)
        drawFullLine: (position, orientation, draw) => {
          // For horizontal: draws all horizontal segments at row boundary `position`
          // For vertical: draws all vertical segments at column boundary `position`
        },

        // Get highlight color for cell, considering overlap order
        getCellHighlightColor: (cellX, cellY) => {
          const { highlights } = get();
          // Filter highlights that affect this cell
          const affecting = highlights.filter(h =>
            (h.type === 'row' && h.index === cellY) ||
            (h.type === 'col' && h.index === cellX)
          );
          if (affecting.length === 0) return null;
          // Return the one with latest timestamp
          return affecting.reduce((a, b) => a.timestamp > b.timestamp ? a : b).color;
        },

        // Statistics selector
        getStatistics: () => {
          const { width, height, lines } = get();
          let minX = Infinity, maxX = -Infinity;
          let minY = Infinity, maxY = -Infinity;
          let horizontalCount = 0, verticalCount = 0;

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

          return {
            size: { width, height },
            boundingBox: lines.size > 0 ? { minX, maxX, minY, maxY } : null,
            horizontalLineCount: horizontalCount,
            verticalLineCount: verticalCount,
            totalLineCount: lines.size,
          };
        },

        // ... other implementations
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
      equality: (a, b) => {
        // Custom equality to handle Map
        return JSON.stringify(a, mapReplacer) === JSON.stringify(b, mapReplacer);
      },
    }
  )
);

// Temporal store hook for undo/redo
export const useTemporalStore = <T>(selector: (state: TemporalState) => T) =>
  useCanvasStore.temporal(selector);
```

### Storage Utilities

```typescript
// utils/storage.ts

/**
 * JSON replacer/reviver for Map serialization.
 * Converts Map to { __type: 'Map', entries: [...] }
 */
export function mapReplacer(key: string, value: unknown): unknown {
  if (value instanceof Map) {
    return {
      __type: 'Map',
      entries: Array.from(value.entries()),
    };
  }
  return value;
}

export function mapReviver(key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && '__type' in value && value.__type === 'Map') {
    return new Map((value as { entries: [string, unknown][] }).entries);
  }
  return value;
}
```

### Viewport Store

```typescript
// store/useViewportStore.ts

interface ViewportStore {
  offsetX: number;
  offsetY: number;
  cellSize: number;

  pan: (deltaX: number, deltaY: number) => void;
  zoom: (delta: number, cursorX: number, cursorY: number) => void;
  centerOn: (canvasX: number, canvasY: number) => void;
  reset: () => void;
}

// No persistence, no history - viewport is session-only
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

  reset: () => set({
    offsetX: 0,
    offsetY: 0,
    cellSize: VIEWPORT_LIMITS.DEFAULT_CELL_SIZE,
  }),
}));
```

### UI Store

```typescript
// store/useUIStore.ts

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface UIStore {
  sidebarCollapsed: boolean;
  toasts: Toast[];

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarCollapsed: false,
  toasts: [],

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  showToast: (message, type = 'info', duration = 3000) => {
    const id = crypto.randomUUID();
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), duration);
  },

  removeToast: (id) => set((s) => ({
    toasts: s.toasts.filter((t) => t.id !== id),
  })),
}));
```

---

## Canvas Rendering

### Renderer Class

```typescript
// utils/canvas/renderer.ts

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr: number; // Device pixel ratio for sharp rendering

  constructor(canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.dpr = window.devicePixelRatio || 1;
  }

  render(
    canvasWidth: number,
    canvasHeight: number,
    lines: Map<string, Line>,
    highlights: CellHighlight[],
    viewport: Viewport,
    getCellColor: (x: number, y: number) => string | null
  ) {
    this.setupCanvas(viewport);
    this.clear();

    // Layer 1: Cell highlights (underneath everything)
    this.drawCellHighlights(canvasWidth, canvasHeight, viewport, getCellColor);

    // Layer 2: Grid
    this.drawGrid(canvasWidth, canvasHeight, viewport);
    this.drawMajorGridLines(canvasWidth, canvasHeight, viewport);

    // Layer 3: Numbers (row/column labels)
    this.drawNumbers(canvasWidth, canvasHeight, viewport);

    // Layer 4: User lines (on top)
    this.drawLines(lines, viewport);
  }

  private drawGrid(width: number, height: number, viewport: Viewport) {
    // Thin gray lines (#E0E0E0)
    const { offsetX, offsetY, cellSize } = viewport;
    this.ctx.strokeStyle = '#E0E0E0';
    this.ctx.lineWidth = 1;

    // Draw only visible lines for performance
    // ... implementation
  }

  private drawMajorGridLines(width: number, height: number, viewport: Viewport) {
    // Slightly thicker, still pale (#BDBDBD) every 10 cells
    this.ctx.strokeStyle = '#BDBDBD';
    this.ctx.lineWidth = 1.5;
    // ... implementation
  }

  private drawLines(lines: Map<string, Line>, viewport: Viewport) {
    // User-drawn lines with their colors
    lines.forEach((line) => {
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = 2;
      // ... draw line at correct position
    });
  }

  // ... other methods
}
```

### Hit Testing

```typescript
// utils/canvas/hitTest.ts

export type HitType =
  | 'horizontal-line'
  | 'vertical-line'
  | 'row-number'
  | 'col-number'
  | 'row-tail'    // Tail area for drawing full horizontal lines
  | 'col-tail'    // Tail area for drawing full vertical lines
  | 'none';

export interface HitTestResult {
  type: HitType;
  // For lines: grid coordinates
  x: number;
  y: number;
}

const TOLERANCE = 0.25; // 1/4 of cell size
const NUMBER_AREA_WIDTH = 30; // Pixels for number labels

export function hitTest(
  screenX: number,
  screenY: number,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number
): HitTestResult {
  const { offsetX, offsetY, cellSize } = viewport;

  // Convert to grid coordinates
  const gridX = (screenX - offsetX - NUMBER_AREA_WIDTH) / cellSize;
  const gridY = (screenY - offsetY - NUMBER_AREA_WIDTH) / cellSize;

  // Check if in number/tail area
  if (screenX < offsetX + NUMBER_AREA_WIDTH) {
    // Left area: row numbers or row tails
    const rowIndex = Math.floor(gridY);
    if (rowIndex >= 0 && rowIndex < canvasHeight) {
      // Check if near a horizontal grid line (tail)
      const distToLine = Math.abs(gridY - Math.round(gridY));
      if (distToLine < TOLERANCE) {
        return { type: 'row-tail', x: 0, y: Math.round(gridY) };
      }
      return { type: 'row-number', x: 0, y: rowIndex };
    }
  }

  if (screenY < offsetY + NUMBER_AREA_WIDTH) {
    // Top area: column numbers or column tails
    const colIndex = Math.floor(gridX);
    if (colIndex >= 0 && colIndex < canvasWidth) {
      const distToLine = Math.abs(gridX - Math.round(gridX));
      if (distToLine < TOLERANCE) {
        return { type: 'col-tail', x: Math.round(gridX), y: 0 };
      }
      return { type: 'col-number', x: colIndex, y: 0 };
    }
  }

  // Main grid area
  if (gridX < 0 || gridX > canvasWidth || gridY < 0 || gridY > canvasHeight) {
    return { type: 'none', x: 0, y: 0 };
  }

  // Check proximity to grid lines
  const distToHorizontal = Math.abs(gridY - Math.round(gridY));
  const distToVertical = Math.abs(gridX - Math.round(gridX));

  if (distToHorizontal < TOLERANCE && distToVertical < TOLERANCE) {
    // Near intersection - pick closer one
    if (distToHorizontal < distToVertical) {
      return {
        type: 'horizontal-line',
        x: Math.floor(gridX),
        y: Math.round(gridY),
      };
    } else {
      return {
        type: 'vertical-line',
        x: Math.round(gridX),
        y: Math.floor(gridY),
      };
    }
  }

  if (distToHorizontal < TOLERANCE) {
    return {
      type: 'horizontal-line',
      x: Math.floor(gridX),
      y: Math.round(gridY),
    };
  }

  if (distToVertical < TOLERANCE) {
    return {
      type: 'vertical-line',
      x: Math.round(gridX),
      y: Math.floor(gridY),
    };
  }

  return { type: 'none', x: 0, y: 0 };
}
```

---

## Color Utilities

```typescript
// utils/colors.ts

/**
 * Convert hex color to pale version for cell highlighting.
 * Increases lightness while preserving hue.
 */
export function toPaleColor(hex: string, opacity: number = 0.25): string {
  // Convert to rgba with low opacity
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

// constants/colors.ts

/**
 * 8-color palette based on Google Material Design.
 * Chosen for contrast and visual appeal.
 */
export const COLOR_PALETTE = [
  '#000000', // Black (default)
  '#D32F2F', // Red
  '#1976D2', // Blue
  '#388E3C', // Green
  '#F57C00', // Orange
  '#7B1FA2', // Purple
  '#0097A7', // Teal
  '#5D4037', // Brown
] as const;

export const DEFAULT_COLOR = COLOR_PALETTE[0];
```

---

## Event Handling Flow

```
User Action                     Handler                    Store Update
-------------------------------------------------------------------------------
Left click on line border  ->  handleClick()         ->  addLine() or recolorLine()
Right click on line        ->  handleContextMenu()   ->  removeLine()
Left drag                  ->  handleMouseMove()     ->  addLine() (multiple)
Right drag                 ->  handleMouseMove()     ->  removeLine() (multiple)
Mouse wheel                ->  handleWheel()         ->  viewport.zoom()
Middle mouse drag          ->  handleMouseMove()     ->  viewport.pan()
Shift + left click         ->  handleClick()         ->  extendLine()
Ctrl + left click          ->  handleClick()         ->  floodFill() + showToast()
Click on row number        ->  handleClick()         ->  addHighlight()
Right click on row number  ->  handleContextMenu()   ->  removeHighlight()
Click on row tail          ->  handleClick()         ->  drawFullLine()
```

---

## Performance Considerations

1. **Map<string, Line>** - O(1) operations
2. **Visible-only rendering** - Calculate visible cell range from viewport
3. **requestAnimationFrame** - Batch render calls
4. **Debounced persistence** - Save to localStorage max once per 500ms
5. **Device pixel ratio** - Sharp rendering on HiDPI displays

---

## Error Handling

1. **ErrorBoundary** - Wraps Canvas component, shows fallback UI
2. **JSON import validation** - Schema check before importing
3. **Toast notifications** - User feedback for errors (flood fill failed, etc.)

---

## Testing Strategy

```
|-- __tests__/
|   |-- utils/
|   |   |-- hitTest.test.ts
|   |   |-- floodFill.test.ts
|   |   +-- coordinates.test.ts
|   |
|   |-- store/
|   |   +-- useCanvasStore.test.ts
|   |
|   +-- components/
|       +-- Canvas.test.tsx
```

- **Unit tests**: Utilities (hitTest, floodFill, coordinates)
- **Integration tests**: Store actions and state updates
- **E2E tests**: Critical user flows (draw, save, load)

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "zustand": "^4.5.0",
    "zundo": "^2.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### Epic 5 Dependencies (lazy loaded)

```json
{
  "dependencies": {
    "jspdf": "^2.5.0"
  }
}
```

---

## File Naming Conventions

- Components: `PascalCase.tsx`
- Hooks: `useCamelCase.ts`
- Utilities: `camelCase.ts`
- Types: `camelCase.ts`
- Tests: `*.test.ts` or `*.test.tsx`
- Styles: `ComponentName.module.css`
