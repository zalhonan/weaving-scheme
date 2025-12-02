import { useCallback, useRef, useState } from 'react';
import { useCanvasStore, useViewportStore, useUIStore } from '../../store';
import { hitTest, HitTestResult } from '../../utils/canvas/hitTest';
import { screenToGrid } from '../../utils/canvas/coordinates';
import {
  extendLineToNearest,
  getFullRowLines,
  getFullColumnLines,
} from '../../utils/canvas/advancedDrawing';
import { floodFill } from '../../utils/canvas/floodFill';
import { isEraser } from '../../constants/colors';

type MouseButton = 'left' | 'right' | 'middle' | null;
type MovementDirection = 'horizontal' | 'vertical' | null;

// How close cursor must be to a boundary to prefer that direction's lines (in grid units)
const BOUNDARY_PROXIMITY_THRESHOLD = 0.35;
// Minimum screen movement to determine direction
const MIN_MOVEMENT_TO_DETECT_DIRECTION = 3;

export function useCanvasInteraction(
  canvasRef: React.RefObject<HTMLCanvasElement | null>
) {
  const {
    width,
    height,
    lines,
    currentColor,
    toggleLine,
    removeLine,
    addMultipleLines,
    removeMultipleLines,
    setRowHighlight,
    setColHighlight,
    removeRowHighlight,
    removeColHighlight,
  } = useCanvasStore();
  const { offsetX, offsetY, cellSize, pan, zoom } = useViewportStore();
  const { showToast } = useUIStore();

  const [isPanning, setIsPanning] = useState(false);
  const lastPanPos = useRef<{ x: number; y: number } | null>(null);
  const activeButton = useRef<MouseButton>(null);
  const lastHit = useRef<HitTestResult | null>(null);
  // Track movement direction based on accumulated screen deltas
  const movementDirection = useRef<MovementDirection>(null);
  const dragStartScreenPos = useRef<{ x: number; y: number } | null>(null);
  const accumulatedDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const lastScreenPos = useRef<{ x: number; y: number } | null>(null);

  const getCanvasCoords = useCallback(
    (e: React.MouseEvent | MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    },
    [canvasRef]
  );

  const handleLineInteraction = useCallback(
    (hit: HitTestResult, isErase: boolean) => {
      if (hit.type === 'horizontal-line') {
        if (isErase) {
          removeLine(hit.x, hit.y, 'horizontal');
        } else {
          toggleLine(hit.x, hit.y, 'horizontal');
        }
      } else if (hit.type === 'vertical-line') {
        if (isErase) {
          removeLine(hit.x, hit.y, 'vertical');
        } else {
          toggleLine(hit.x, hit.y, 'vertical');
        }
      }
    },
    [toggleLine, removeLine]
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      e.preventDefault();

      const { x, y } = getCanvasCoords(e);

      // Middle button - start panning
      if (e.button === 1) {
        setIsPanning(true);
        lastPanPos.current = { x, y };
        activeButton.current = 'middle';
        return;
      }

      // Left or right button - drawing/erasing
      const isLeftButton = e.button === 0;
      const isRightButton = e.button === 2;

      if (!isLeftButton && !isRightButton) return;

      // Check if eraser is selected - treat left click as erase
      const eraserSelected = isEraser(currentColor);
      const shouldErase = isRightButton || (isLeftButton && eraserSelected);

      activeButton.current = isLeftButton ? 'left' : 'right';

      const hit = hitTest(x, y, offsetX, offsetY, cellSize, width, height);
      lastHit.current = hit;

      // Initialize drag tracking
      dragStartScreenPos.current = { x, y };
      lastScreenPos.current = { x, y };
      accumulatedDelta.current = { dx: 0, dy: 0 };
      movementDirection.current = null;

      // Handle tail clicks (US-3.3)
      if (hit.type === 'row-tail') {
        const rowLines = getFullRowLines(hit.y, width);
        if (shouldErase) {
          removeMultipleLines(rowLines);
        } else {
          addMultipleLines(rowLines);
        }
        return;
      }

      if (hit.type === 'col-tail') {
        const colLines = getFullColumnLines(hit.x, height);
        if (shouldErase) {
          removeMultipleLines(colLines);
        } else {
          addMultipleLines(colLines);
        }
        return;
      }

      // Handle row number clicks (US-4.3)
      if (hit.type === 'row-number') {
        if (shouldErase) {
          removeRowHighlight(hit.y);
        } else {
          setRowHighlight(hit.y);
        }
        return;
      }

      // Handle column number clicks (US-4.3)
      if (hit.type === 'col-number') {
        if (shouldErase) {
          removeColHighlight(hit.x);
        } else {
          setColHighlight(hit.x);
        }
        return;
      }

      // Handle Ctrl+click for flood fill (US-3.2)
      if (e.ctrlKey && isLeftButton) {
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);
        const cellX = Math.floor(gridX);
        const cellY = Math.floor(gridY);

        if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) {
          const result = floodFill(cellX, cellY, lines, width, height);
          if (result.success) {
            addMultipleLines(result.lines);
          } else if (result.error) {
            showToast(result.error, 'error', 3000);
          }
        }
        return;
      }

      // Handle Shift+click for line extension (US-3.1)
      if (e.shiftKey && isLeftButton) {
        if (hit.type === 'horizontal-line') {
          const linesToAdd = extendLineToNearest(
            hit.x,
            hit.y,
            'horizontal',
            lines,
            width,
            height
          );
          if (linesToAdd.length > 0) {
            addMultipleLines(linesToAdd);
          }
          return;
        }
        if (hit.type === 'vertical-line') {
          const linesToAdd = extendLineToNearest(
            hit.x,
            hit.y,
            'vertical',
            lines,
            width,
            height
          );
          if (linesToAdd.length > 0) {
            addMultipleLines(linesToAdd);
          }
          return;
        }
        return;
      }

      handleLineInteraction(hit, shouldErase);
    },
    [
      getCanvasCoords,
      offsetX,
      offsetY,
      cellSize,
      width,
      height,
      lines,
      currentColor,
      handleLineInteraction,
      addMultipleLines,
      removeMultipleLines,
      setRowHighlight,
      setColHighlight,
      removeRowHighlight,
      removeColHighlight,
      showToast,
    ]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasCoords(e);

      // Panning
      if (isPanning && lastPanPos.current) {
        const deltaX = x - lastPanPos.current.x;
        const deltaY = y - lastPanPos.current.y;
        pan(deltaX, deltaY);
        lastPanPos.current = { x, y };
        return;
      }

      // Drawing/erasing while dragging
      if (activeButton.current === 'left' || activeButton.current === 'right') {
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);

        // Update accumulated movement to detect direction
        if (lastScreenPos.current) {
          accumulatedDelta.current.dx += x - lastScreenPos.current.x;
          accumulatedDelta.current.dy += y - lastScreenPos.current.y;
        }
        lastScreenPos.current = { x, y };

        // Determine movement direction from accumulated delta
        const totalMovement =
          Math.abs(accumulatedDelta.current.dx) +
          Math.abs(accumulatedDelta.current.dy);

        if (totalMovement >= MIN_MOVEMENT_TO_DETECT_DIRECTION) {
          if (
            Math.abs(accumulatedDelta.current.dx) >
            Math.abs(accumulatedDelta.current.dy)
          ) {
            movementDirection.current = 'horizontal';
          } else {
            movementDirection.current = 'vertical';
          }
        }

        // Calculate distance to nearest boundaries (0 = on boundary, 0.5 = center of cell)
        const distToHorizontalBoundary = Math.abs(gridY - Math.round(gridY));
        const distToVerticalBoundary = Math.abs(gridX - Math.round(gridX));

        // Determine which line type to draw based on movement direction and proximity
        let preferredLineType: 'horizontal-line' | 'vertical-line' | null =
          null;

        if (movementDirection.current === 'horizontal') {
          // Moving horizontally:
          // - If close to horizontal boundary -> draw horizontal lines
          // - If far from horizontal boundary (middle of cell) -> draw vertical lines
          if (distToHorizontalBoundary <= BOUNDARY_PROXIMITY_THRESHOLD) {
            preferredLineType = 'horizontal-line';
          } else {
            preferredLineType = 'vertical-line';
          }
        } else if (movementDirection.current === 'vertical') {
          // Moving vertically:
          // - If close to vertical boundary -> draw vertical lines
          // - If far from vertical boundary (middle of cell) -> draw horizontal lines
          if (distToVerticalBoundary <= BOUNDARY_PROXIMITY_THRESHOLD) {
            preferredLineType = 'vertical-line';
          } else {
            preferredLineType = 'horizontal-line';
          }
        }

        // Get the hit result
        const hit = hitTest(x, y, offsetX, offsetY, cellSize, width, height);

        // Filter hit based on preferred line type (if we have a preference)
        let allowedHit = hit;
        if (
          preferredLineType &&
          (hit.type === 'horizontal-line' || hit.type === 'vertical-line') &&
          hit.type !== preferredLineType
        ) {
          // Hit is opposite direction - block it
          allowedHit = { type: 'none', x: 0, y: 0 };
        }

        // Only process if we moved to a different line
        if (
          lastHit.current &&
          allowedHit.type !== 'none' &&
          (allowedHit.type !== lastHit.current.type ||
            allowedHit.x !== lastHit.current.x ||
            allowedHit.y !== lastHit.current.y)
        ) {
          // Check if eraser is selected - treat left drag as erase
          const eraserSelected = isEraser(currentColor);
          const shouldErase = activeButton.current === 'right' || (activeButton.current === 'left' && eraserSelected);
          handleLineInteraction(allowedHit, shouldErase);
          lastHit.current = allowedHit;
        }
      }
    },
    [
      getCanvasCoords,
      isPanning,
      pan,
      offsetX,
      offsetY,
      cellSize,
      width,
      height,
      currentColor,
      handleLineInteraction,
    ]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    lastPanPos.current = null;
    activeButton.current = null;
    lastHit.current = null;
    movementDirection.current = null;
    dragStartScreenPos.current = null;
    accumulatedDelta.current = { dx: 0, dy: 0 };
    lastScreenPos.current = null;
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsPanning(false);
    lastPanPos.current = null;
    activeButton.current = null;
    lastHit.current = null;
    movementDirection.current = null;
    dragStartScreenPos.current = null;
    accumulatedDelta.current = { dx: 0, dy: 0 };
    lastScreenPos.current = null;
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is called in Canvas.tsx useEffect with passive: false
      const { x, y } = getCanvasCoords(e);
      const delta = e.deltaY > 0 ? -2 : 2;
      zoom(delta, x, y);
    },
    [getCanvasCoords, zoom]
  );

  return {
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
    handleWheel,
  };
}
