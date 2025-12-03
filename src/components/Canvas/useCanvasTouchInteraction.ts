import { useCallback, useRef, useState } from 'react';
import { useCanvasStore, useViewportStore, useUIStore } from '../../store';
import { useTemporalStore } from '../../store/useCanvasStore';
import { hitTest, HitTestResult } from '../../utils/canvas/hitTest';
import { screenToGrid } from '../../utils/canvas/coordinates';
import {
  getFullRowLines,
  getFullColumnLines,
} from '../../utils/canvas/advancedDrawing';
import { floodFill } from '../../utils/canvas/floodFill';
import { isEraser } from '../../constants/colors';
import {
  GestureState,
  createInitialGestureState,
  touchListToPoints,
  getDistance,
  getMidpoint,
  calculatePinchScale,
  GESTURE_DELAY_MS,
  LONG_PRESS_DURATION_MS,
  TAP_MAX_DURATION_MS,
  TAP_MAX_MOVEMENT_PX,
  triggerHapticFeedback,
} from '../../utils/touch';

type MovementDirection = 'horizontal' | 'vertical' | null;

// Touch-specific hit tolerance (larger for finger input)
const TOUCH_HIT_TOLERANCE = 0.33; // 1/3 of cell vs 1/4 for mouse
const BOUNDARY_PROXIMITY_THRESHOLD = 0.35;
const MIN_MOVEMENT_TO_DETECT_DIRECTION = 5;

export function useCanvasTouchInteraction(
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
  const { undo, redo } = useTemporalStore.getState();

  // Touch mode states
  const [touchMode, setTouchMode] = useState<GestureState['mode']>('none');

  // Gesture state
  const gestureState = useRef<GestureState>(createInitialGestureState());

  // Drawing state
  const lastHit = useRef<HitTestResult | null>(null);
  const movementDirection = useRef<MovementDirection>(null);
  const accumulatedDelta = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const lastTouchPos = useRef<{ x: number; y: number } | null>(null);
  const startTouchPos = useRef<{ x: number; y: number } | null>(null);

  // Multi-touch tracking for undo/redo gestures
  const multiTapStartTime = useRef<number | null>(null);
  const multiTapTouchCount = useRef<number>(0);

  // Double-tap tracking for flood fill
  const lastTapTime = useRef<number>(0);
  const lastTapPos = useRef<{ x: number; y: number } | null>(null);
  const DOUBLE_TAP_DELAY = 300; // ms
  const DOUBLE_TAP_DISTANCE = 30; // px

  const getCanvasRect = useCallback((): DOMRect | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getBoundingClientRect();
  }, [canvasRef]);

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

  const clearGestureState = useCallback(() => {
    if (gestureState.current.longPressTimer) {
      clearTimeout(gestureState.current.longPressTimer);
    }
    gestureState.current = createInitialGestureState();
    lastHit.current = null;
    movementDirection.current = null;
    accumulatedDelta.current = { dx: 0, dy: 0 };
    lastTouchPos.current = null;
    startTouchPos.current = null;
    setTouchMode('none');
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is called in Canvas.tsx useEffect with passive: false

      const rect = getCanvasRect();
      if (!rect) return;

      const touches = touchListToPoints(e.touches, rect);
      const touchCount = touches.length;

      // Store for multi-tap detection
      if (touchCount >= 2) {
        if (!multiTapStartTime.current) {
          multiTapStartTime.current = Date.now();
        }
        multiTapTouchCount.current = Math.max(multiTapTouchCount.current, touchCount);
      }

      // Clear any existing long press timer
      if (gestureState.current.longPressTimer) {
        clearTimeout(gestureState.current.longPressTimer);
        gestureState.current.longPressTimer = null;
      }

      // Multi-touch: pan/zoom mode
      if (touchCount >= 2) {
        // Cancel any pending drawing mode
        if (gestureState.current.mode === 'pending' || gestureState.current.mode === 'drawing') {
          clearGestureState();
        }

        const p1 = touches[0];
        const p2 = touches[1];

        gestureState.current.mode = touchCount === 2 ? 'panning' : 'zooming';
        gestureState.current.touches = touches;
        gestureState.current.initialDistance = getDistance(p1, p2);
        gestureState.current.initialMidpoint = getMidpoint(p1, p2);
        gestureState.current.startTimestamp = Date.now();

        setTouchMode(gestureState.current.mode);
        return;
      }

      // Single touch: start pending mode (wait to distinguish from multi-touch)
      const touch = touches[0];
      startTouchPos.current = { x: touch.x, y: touch.y };
      lastTouchPos.current = { x: touch.x, y: touch.y };

      gestureState.current.mode = 'pending';
      gestureState.current.touches = touches;
      gestureState.current.startTimestamp = Date.now();

      // Set up long press timer for erase mode
      gestureState.current.longPressTimer = setTimeout(() => {
        if (gestureState.current.mode === 'pending') {
          // Activate erase mode
          gestureState.current.mode = 'erasing';
          setTouchMode('erasing');
          triggerHapticFeedback(15);

          // Perform initial erase at current position
          const currentPos = lastTouchPos.current;
          if (currentPos) {
            const hit = hitTest(
              currentPos.x,
              currentPos.y,
              offsetX,
              offsetY,
              cellSize,
              width,
              height,
              TOUCH_HIT_TOLERANCE
            );
            if (hit.type === 'horizontal-line' || hit.type === 'vertical-line') {
              handleLineInteraction(hit, true);
              lastHit.current = hit;
            }
          }
        }
      }, LONG_PRESS_DURATION_MS);

      setTouchMode('pending');

      // After delay, if still single touch, switch to drawing mode
      setTimeout(() => {
        if (
          gestureState.current.mode === 'pending' &&
          gestureState.current.touches.length === 1
        ) {
          gestureState.current.mode = 'drawing';
          setTouchMode('drawing');

          // Perform initial hit test and draw
          const currentPos = lastTouchPos.current || startTouchPos.current;
          if (currentPos) {
            const hit = hitTest(
              currentPos.x,
              currentPos.y,
              offsetX,
              offsetY,
              cellSize,
              width,
              height,
              TOUCH_HIT_TOLERANCE
            );

            // Check if eraser tool is selected
            const eraserSelected = isEraser(currentColor);

            // Handle special hits (tails, numbers)
            if (hit.type === 'row-tail') {
              if (eraserSelected) {
                removeMultipleLines(getFullRowLines(hit.y, width));
              } else {
                addMultipleLines(getFullRowLines(hit.y, width));
              }
              return;
            }
            if (hit.type === 'col-tail') {
              if (eraserSelected) {
                removeMultipleLines(getFullColumnLines(hit.x, height));
              } else {
                addMultipleLines(getFullColumnLines(hit.x, height));
              }
              return;
            }
            if (hit.type === 'row-number') {
              if (eraserSelected) {
                removeRowHighlight(hit.y);
              } else {
                setRowHighlight(hit.y);
              }
              return;
            }
            if (hit.type === 'col-number') {
              if (eraserSelected) {
                removeColHighlight(hit.x);
              } else {
                setColHighlight(hit.x);
              }
              return;
            }

            // Normal line drawing - erase if eraser selected
            if (hit.type === 'horizontal-line' || hit.type === 'vertical-line') {
              handleLineInteraction(hit, eraserSelected);
              lastHit.current = hit;
            }
          }
        }
      }, GESTURE_DELAY_MS);
    },
    [
      getCanvasRect,
      clearGestureState,
      offsetX,
      offsetY,
      cellSize,
      width,
      height,
      currentColor,
      handleLineInteraction,
      addMultipleLines,
      removeMultipleLines,
      setRowHighlight,
      setColHighlight,
      removeRowHighlight,
      removeColHighlight,
    ]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is called in Canvas.tsx useEffect with passive: false

      const rect = getCanvasRect();
      if (!rect) return;

      const touches = touchListToPoints(e.touches, rect);
      const touchCount = touches.length;

      // Multi-touch: pinch zoom and pan
      if (touchCount >= 2 && gestureState.current.initialDistance !== null) {
        const p1 = touches[0];
        const p2 = touches[1];
        const currentDistance = getDistance(p1, p2);
        const currentMidpoint = getMidpoint(p1, p2);

        // Calculate zoom
        if (gestureState.current.initialDistance > 0) {
          const scale = calculatePinchScale(
            currentDistance,
            gestureState.current.initialDistance
          );

          // Convert scale to zoom delta
          const zoomDelta = (scale - 1) * 10;

          if (Math.abs(zoomDelta) > 0.1) {
            zoom(zoomDelta, currentMidpoint.x, currentMidpoint.y);
            gestureState.current.initialDistance = currentDistance;
          }
        }

        // Calculate pan
        if (gestureState.current.initialMidpoint) {
          const dx = currentMidpoint.x - gestureState.current.initialMidpoint.x;
          const dy = currentMidpoint.y - gestureState.current.initialMidpoint.y;

          if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
            pan(dx, dy);
            gestureState.current.initialMidpoint = currentMidpoint;
          }
        }

        gestureState.current.touches = touches;
        return;
      }

      // Single touch drawing/erasing
      if (
        touchCount === 1 &&
        (gestureState.current.mode === 'drawing' ||
          gestureState.current.mode === 'erasing' ||
          gestureState.current.mode === 'pending')
      ) {
        const touch = touches[0];
        // Erase if long-press erasing mode OR eraser tool is selected
        const eraserSelected = isEraser(currentColor);
        const shouldErase = gestureState.current.mode === 'erasing' || eraserSelected;

        // Cancel long press if moved significantly during pending
        if (gestureState.current.mode === 'pending' && startTouchPos.current) {
          const moveDistance = Math.sqrt(
            Math.pow(touch.x - startTouchPos.current.x, 2) +
            Math.pow(touch.y - startTouchPos.current.y, 2)
          );

          if (moveDistance > TAP_MAX_MOVEMENT_PX) {
            // Cancel long press and switch to drawing
            if (gestureState.current.longPressTimer) {
              clearTimeout(gestureState.current.longPressTimer);
              gestureState.current.longPressTimer = null;
            }
            gestureState.current.mode = 'drawing';
            setTouchMode('drawing');
          }
        }

        // Skip if still pending
        if (gestureState.current.mode === 'pending') {
          lastTouchPos.current = { x: touch.x, y: touch.y };
          return;
        }

        // Update accumulated movement for direction detection
        if (lastTouchPos.current) {
          accumulatedDelta.current.dx += touch.x - lastTouchPos.current.x;
          accumulatedDelta.current.dy += touch.y - lastTouchPos.current.y;
        }
        lastTouchPos.current = { x: touch.x, y: touch.y };

        // Determine movement direction
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

        // Get grid position
        const { gridX, gridY } = screenToGrid(
          touch.x,
          touch.y,
          offsetX,
          offsetY,
          cellSize
        );

        // Calculate proximity to boundaries
        const distToHorizontalBoundary = Math.abs(gridY - Math.round(gridY));
        const distToVerticalBoundary = Math.abs(gridX - Math.round(gridX));

        // Determine preferred line type based on movement direction
        let preferredLineType: 'horizontal-line' | 'vertical-line' | null = null;

        if (movementDirection.current === 'horizontal') {
          if (distToHorizontalBoundary <= BOUNDARY_PROXIMITY_THRESHOLD) {
            preferredLineType = 'horizontal-line';
          } else {
            preferredLineType = 'vertical-line';
          }
        } else if (movementDirection.current === 'vertical') {
          if (distToVerticalBoundary <= BOUNDARY_PROXIMITY_THRESHOLD) {
            preferredLineType = 'vertical-line';
          } else {
            preferredLineType = 'horizontal-line';
          }
        }

        // Hit test
        const hit = hitTest(
          touch.x,
          touch.y,
          offsetX,
          offsetY,
          cellSize,
          width,
          height,
          TOUCH_HIT_TOLERANCE
        );

        // Filter hit based on preferred direction
        let allowedHit = hit;
        if (
          preferredLineType &&
          (hit.type === 'horizontal-line' || hit.type === 'vertical-line') &&
          hit.type !== preferredLineType
        ) {
          allowedHit = { type: 'none', x: 0, y: 0 };
        }

        // Process if moved to different line
        if (
          lastHit.current &&
          allowedHit.type !== 'none' &&
          (allowedHit.type !== lastHit.current.type ||
            allowedHit.x !== lastHit.current.x ||
            allowedHit.y !== lastHit.current.y)
        ) {
          handleLineInteraction(allowedHit, shouldErase);
          lastHit.current = allowedHit;
        } else if (!lastHit.current && allowedHit.type !== 'none') {
          handleLineInteraction(allowedHit, shouldErase);
          lastHit.current = allowedHit;
        }

        gestureState.current.touches = touches;
      }
    },
    [
      getCanvasRect,
      zoom,
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

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is called in Canvas.tsx useEffect with passive: false

      const rect = getCanvasRect();
      if (!rect) return;

      const remainingTouches = touchListToPoints(e.touches, rect);
      const now = Date.now();

      // Check for single-finger double-tap (flood fill)
      if (
        remainingTouches.length === 0 &&
        gestureState.current.touches.length === 1 &&
        startTouchPos.current &&
        multiTapTouchCount.current <= 1 // Only single finger touches
      ) {
        const touchPos = startTouchPos.current;
        const timeSinceLastTap = now - lastTapTime.current;
        const wasQuickTap = (now - (gestureState.current.startTimestamp || 0)) < TAP_MAX_DURATION_MS;

        // Check if moved very little (was a tap, not a draw)
        const totalMovement = Math.abs(accumulatedDelta.current.dx) + Math.abs(accumulatedDelta.current.dy);
        const wasTap = wasQuickTap && totalMovement < TAP_MAX_MOVEMENT_PX;

        if (wasTap) {
          // Check if it's a double-tap
          if (
            lastTapPos.current &&
            timeSinceLastTap < DOUBLE_TAP_DELAY
          ) {
            const tapDistance = Math.sqrt(
              Math.pow(touchPos.x - lastTapPos.current.x, 2) +
              Math.pow(touchPos.y - lastTapPos.current.y, 2)
            );

            if (tapDistance < DOUBLE_TAP_DISTANCE) {
              // Double-tap detected! Check if NOT on a line before triggering flood fill
              const tapHit = hitTest(
                touchPos.x,
                touchPos.y,
                offsetX,
                offsetY,
                cellSize,
                width,
                height,
                TOUCH_HIT_TOLERANCE
              );

              // Only trigger flood fill if tap was NOT on a line
              if (tapHit.type !== 'horizontal-line' && tapHit.type !== 'vertical-line') {
                const { gridX, gridY } = screenToGrid(
                  touchPos.x,
                  touchPos.y,
                  offsetX,
                  offsetY,
                  cellSize
                );
                const cellX = Math.floor(gridX);
                const cellY = Math.floor(gridY);

                if (cellX >= 0 && cellX < width && cellY >= 0 && cellY < height) {
                  const result = floodFill(cellX, cellY, lines, width, height);
                  if (result.success) {
                    addMultipleLines(result.lines);
                    triggerHapticFeedback(15);
                    showToast('Заливка', 'success', 1000);
                  } else if (result.error) {
                    showToast(result.error, 'error', 2000);
                  }
                }
              }

              // Reset double-tap tracking
              lastTapTime.current = 0;
              lastTapPos.current = null;
            } else {
              // Different position - start new tap sequence
              lastTapTime.current = now;
              lastTapPos.current = touchPos;
            }
          } else {
            // First tap or too slow - record for potential double-tap
            lastTapTime.current = now;
            lastTapPos.current = touchPos;
          }
        }
      }

      // Check for multi-tap gestures (undo/redo)
      if (multiTapStartTime.current !== null) {
        const duration = Date.now() - multiTapStartTime.current;
        const fingerCount = multiTapTouchCount.current;

        // Quick multi-tap: undo (2 fingers) or redo (3 fingers)
        if (duration < TAP_MAX_DURATION_MS && remainingTouches.length === 0) {
          if (fingerCount === 2) {
            undo();
            triggerHapticFeedback(10);
            showToast('Отмена', 'info', 1000);
          } else if (fingerCount >= 3) {
            redo();
            triggerHapticFeedback(10);
            showToast('Повтор', 'info', 1000);
          }
        }

        // Reset multi-tap tracking
        multiTapStartTime.current = null;
        multiTapTouchCount.current = 0;
      }

      // Handle long press release on row/col numbers (remove highlight)
      if (gestureState.current.mode === 'erasing' && startTouchPos.current) {
        const hit = hitTest(
          startTouchPos.current.x,
          startTouchPos.current.y,
          offsetX,
          offsetY,
          cellSize,
          width,
          height,
          TOUCH_HIT_TOLERANCE
        );

        if (hit.type === 'row-number') {
          removeRowHighlight(hit.y);
        } else if (hit.type === 'col-number') {
          removeColHighlight(hit.x);
        } else if (hit.type === 'row-tail') {
          removeMultipleLines(getFullRowLines(hit.y, width));
        } else if (hit.type === 'col-tail') {
          removeMultipleLines(getFullColumnLines(hit.x, height));
        }
      }

      // If all touches ended, clear state
      if (remainingTouches.length === 0) {
        clearGestureState();
        return;
      }

      // If returning to single touch from multi-touch, reset to drawing
      if (remainingTouches.length === 1) {
        gestureState.current.mode = 'drawing';
        gestureState.current.touches = remainingTouches;
        gestureState.current.initialDistance = null;
        gestureState.current.initialMidpoint = null;
        lastTouchPos.current = { x: remainingTouches[0].x, y: remainingTouches[0].y };
        setTouchMode('drawing');
      }
    },
    [
      getCanvasRect,
      clearGestureState,
      undo,
      redo,
      showToast,
      offsetX,
      offsetY,
      cellSize,
      width,
      height,
      lines,
      addMultipleLines,
      removeRowHighlight,
      removeColHighlight,
      removeMultipleLines,
    ]
  );

  const handleTouchCancel = useCallback(
    (_e: React.TouchEvent<HTMLCanvasElement>) => {
      // Note: preventDefault is called in Canvas.tsx useEffect with passive: false
      clearGestureState();
    },
    [clearGestureState]
  );

  return {
    touchMode,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}
