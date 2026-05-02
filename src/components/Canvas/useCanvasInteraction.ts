import { useCallback, useRef, useState } from 'react';
import {
  useCanvasStore,
  useViewportStore,
  useUIStore,
  useSelectionStore,
} from '../../store';
import { hitTest, HitTestResult } from '../../utils/canvas/hitTest';
import { screenToGrid } from '../../utils/canvas/coordinates';
import {
  extendLineToNearest,
  getFullRowLines,
  getFullColumnLines,
} from '../../utils/canvas/advancedDrawing';
import { floodFill } from '../../utils/canvas/floodFill';
import { bbox, fromRect } from '../../utils/canvas/selection/maskUtils';
import {
  appendPoint,
  cellsInPolygon,
  type Point,
} from '../../utils/canvas/selection/lasso';
import type { RefineMode } from '../../types';
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
  // Selection-tool drag state. Anchor cell of a rectangle marquee.
  const marqueeAnchor = useRef<{ x: number; y: number } | null>(null);
  // Lasso polygon points (in fractional grid coords) being collected during drag.
  const lassoPoints = useRef<Point[] | null>(null);
  // Modifier captured at drag start: 'add' (Shift) or 'subtract' (Ctrl/Cmd) overrides
  // the toolbar refineMode for THIS drag only. Null = no override (use store's mode).
  const dragRefineOverride = useRef<RefineMode | null>(null);
  // Ghost-drag state: last cell seen, for incremental adjustGhost deltas.
  const ghostDragLastCell = useRef<{ x: number; y: number } | null>(null);

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

      // Middle button - start panning (works in any tool)
      if (e.button === 1) {
        setIsPanning(true);
        lastPanPos.current = { x, y };
        activeButton.current = 'middle';
        return;
      }

      // Tool-mode dispatch: selection tools take priority over draw paths.
      const sel = useSelectionStore.getState();
      const tool = sel.tool;

      if (tool === 'select-rect' || tool === 'select-lasso') {
        if (e.button !== 0) return; // only left button starts marquee/ghost-drag
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);
        const cellX = Math.floor(gridX);
        const cellY = Math.floor(gridY);
        const inBounds =
          cellX >= 0 && cellX < width && cellY >= 0 && cellY < height;

        // Ghost active: clicks inside ghost bbox = drag-ghost; clicks outside = commit.
        if (sel.ghost) {
          const ghostBbox = bbox(sel.ghost.destMask);
          const insideGhost =
            ghostBbox !== null &&
            cellX >= ghostBbox.minX &&
            cellX <= ghostBbox.maxX &&
            cellY >= ghostBbox.minY &&
            cellY <= ghostBbox.maxY;
          if (insideGhost) {
            activeButton.current = 'left';
            ghostDragLastCell.current = { x: cellX, y: cellY };
          } else {
            sel.commitGhost();
          }
          return;
        }

        // Capture refinement-modifier override for THIS drag only.
        // Shift → add, Ctrl/Cmd → subtract. Read once at mouseDown; mid-drag
        // modifier changes do not re-evaluate (matches image-editor convention).
        const override: RefineMode | null = e.shiftKey
          ? 'add'
          : e.ctrlKey || e.metaKey
            ? 'subtract'
            : null;
        dragRefineOverride.current = override;

        // No modifier + click inside existing selection → start move-ghost drag.
        // With a modifier we always start a refinement drag instead of moving.
        if (override === null && sel.selection && inBounds) {
          const selBbox = bbox(sel.selection);
          const insideSelection =
            selBbox !== null &&
            cellX >= selBbox.minX &&
            cellX <= selBbox.maxX &&
            cellY >= selBbox.minY &&
            cellY <= selBbox.maxY;
          if (insideSelection) {
            sel.beginMoveGhost();
            if (useSelectionStore.getState().ghost) {
              activeButton.current = 'left';
              ghostDragLastCell.current = { x: cellX, y: cellY };
              dragRefineOverride.current = null;
              return;
            }
          }
        }

        if (tool === 'select-lasso') {
          if (!inBounds) return;
          activeButton.current = 'left';
          const start: Point = { x: gridX, y: gridY };
          lassoPoints.current = [start];
          sel.setMarqueePreview({ kind: 'lasso', lasso: [start] });
          return;
        }

        // select-rect — fresh marquee
        if (!inBounds) return;
        activeButton.current = 'left';
        marqueeAnchor.current = { x: cellX, y: cellY };
        sel.setMarqueePreview({
          kind: 'rect',
          rect: { x0: cellX, y0: cellY, x1: cellX, y1: cellY },
        });
        return;
      }

      // tool === 'draw' — existing draw/erase pipeline.
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

      // Handle Shift+click for line extension (US-3.1) - only for line hits
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
        // If Shift+click not on a line, fall through to normal handling
      }

      // Handle Ctrl+click for flood fill (US-3.2) - only when NOT clicking on a line
      if (e.ctrlKey && isLeftButton && hit.type !== 'horizontal-line' && hit.type !== 'vertical-line') {
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

      // Ghost-drag in progress — emit incremental adjustGhost deltas.
      if (ghostDragLastCell.current && activeButton.current === 'left') {
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);
        const cellX = Math.floor(gridX);
        const cellY = Math.floor(gridY);
        const dx = cellX - ghostDragLastCell.current.x;
        const dy = cellY - ghostDragLastCell.current.y;
        if (dx !== 0 || dy !== 0) {
          useSelectionStore.getState().adjustGhost(dx, dy);
          ghostDragLastCell.current = { x: cellX, y: cellY };
        }
        return;
      }

      // Lasso drag in progress — append point if min-distance away (5px screen
      // ≈ 5/cellSize grid units), update preview polyline.
      if (lassoPoints.current && activeButton.current === 'left') {
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);
        const minDistGrid = 5 / cellSize;
        const next = appendPoint(
          lassoPoints.current,
          { x: gridX, y: gridY },
          minDistGrid,
        );
        if (next !== lassoPoints.current) {
          lassoPoints.current = next;
          useSelectionStore.getState().setMarqueePreview({
            kind: 'lasso',
            lasso: next,
          });
        }
        return;
      }

      // Marquee drag in progress — update preview rect.
      if (marqueeAnchor.current && activeButton.current === 'left') {
        const { gridX, gridY } = screenToGrid(x, y, offsetX, offsetY, cellSize);
        const cellX = Math.max(0, Math.min(width - 1, Math.floor(gridX)));
        const cellY = Math.max(0, Math.min(height - 1, Math.floor(gridY)));
        useSelectionStore.getState().setMarqueePreview({
          kind: 'rect',
          rect: {
            x0: marqueeAnchor.current.x,
            y0: marqueeAnchor.current.y,
            x1: cellX,
            y1: cellY,
          },
        });
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

  const commitMarquee = useCallback(() => {
    const sel = useSelectionStore.getState();
    const preview = sel.marqueePreview;
    const overrideMode = dragRefineOverride.current ?? undefined;
    if (preview) {
      if (preview.kind === 'rect' && preview.rect) {
        const { x0, y0, x1, y1 } = preview.rect;
        sel.setSelection(fromRect(x0, y0, x1, y1), overrideMode);
      } else if (preview.kind === 'lasso' && preview.lasso) {
        const mask = cellsInPolygon(preview.lasso, width, height);
        sel.setSelection(mask, overrideMode);
      }
    }
    sel.setMarqueePreview(null);
    marqueeAnchor.current = null;
    lassoPoints.current = null;
    dragRefineOverride.current = null;
  }, [width, height]);

  const handleMouseUp = useCallback(() => {
    if (marqueeAnchor.current || lassoPoints.current) {
      commitMarquee();
    }
    // Releasing the mouse during ghost-drag does NOT auto-commit per spec;
    // we just stop tracking incremental deltas. User confirms via Enter or
    // by clicking outside the ghost bbox.
    ghostDragLastCell.current = null;
    setIsPanning(false);
    lastPanPos.current = null;
    activeButton.current = null;
    lastHit.current = null;
    movementDirection.current = null;
    dragStartScreenPos.current = null;
    accumulatedDelta.current = { dx: 0, dy: 0 };
    lastScreenPos.current = null;
  }, [commitMarquee]);

  const handleMouseLeave = useCallback(() => {
    if (marqueeAnchor.current || lassoPoints.current) {
      // Treat leaving the canvas mid-drag as commit (using last known points).
      commitMarquee();
    }
    ghostDragLastCell.current = null;
    setIsPanning(false);
    lastPanPos.current = null;
    activeButton.current = null;
    lastHit.current = null;
    movementDirection.current = null;
    dragStartScreenPos.current = null;
    accumulatedDelta.current = { dx: 0, dy: 0 };
    lastScreenPos.current = null;
  }, [commitMarquee]);

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
