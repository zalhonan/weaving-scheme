import { useCallback, useEffect, useRef } from 'react';
import { useSelectionStore, useViewportStore } from '../../store';
import { renderOverlay } from '../../utils/canvas/overlayRenderer';
import { traceBoundary } from '../../utils/canvas/selection/marchingAnts';

const DASH_CYCLE = 8;       // 4 visible + 4 gap (DASH_LENGTH * 2 from renderer)
const DASH_STEP = 0.5;      // px advance per frame → ~30 px/sec at 60 fps

/**
 * Drives the overlay <canvas>: marching ants, marquee preview, ghost (later
 * slices), axis picker (later slices). RAF loop runs only while overlay
 * content exists; otherwise the canvas is cleared once and the loop stops.
 */
export function useOverlayRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const dashOffsetRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { selection, marqueePreview, ghost } = useSelectionStore.getState();
    const { offsetX, offsetY, cellSize } = useViewportStore.getState();

    // Ants follow the floating layer when a ghost is active; otherwise they
    // wrap the committed selection. The original selection mask is never
    // outlined while a ghost exists — the rectangle moves with the cut piece.
    const antsMask =
      ghost !== null ? ghost.destMask : selection;
    const segments = antsMask !== null ? traceBoundary(antsMask) : [];

    renderOverlay(ctx, {
      offsetX,
      offsetY,
      cellSize,
      selectionSegments: segments,
      marqueePreview,
      ghostLines: ghost ? ghost.lines : [],
      dashOffset: dashOffsetRef.current,
    });
  }, []);

  // RAF tick: advance dash, draw, schedule next.
  const tick = useCallback(() => {
    dashOffsetRef.current = (dashOffsetRef.current + DASH_STEP) % DASH_CYCLE;
    draw();
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  // Start/stop the RAF loop based on overlay-content presence.
  useEffect(() => {
    const isActive = (): boolean => {
      const { selection, ghost, axisPicker, marqueePreview } = useSelectionStore.getState();
      return (
        selection !== null ||
        ghost !== null ||
        axisPicker !== null ||
        marqueePreview !== null
      );
    };

    const evaluate = () => {
      const need = isActive();
      if (need && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      } else if (!need && rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        // Final clear so the previous selection visuals disappear.
        draw();
      }
    };

    evaluate();
    const unsubSelection = useSelectionStore.subscribe(evaluate);
    // Viewport changes (zoom/pan) should redraw immediately even if RAF
    // is idle — the static layer just moved under us.
    const unsubViewport = useViewportStore.subscribe(() => {
      if (rafRef.current === null) draw();
    });

    return () => {
      unsubSelection();
      unsubViewport();
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [tick, draw]);

  // Resync canvas size on layout changes (sidebar toggle, window resize).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => draw());
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [draw]);

  return { canvasRef };
}
