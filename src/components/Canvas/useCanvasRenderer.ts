import { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  useCanvasStore,
  useSelectionStore,
  useViewportStore,
} from '../../store';
import { renderCanvas } from '../../utils/canvas/renderer';
import { getLinesInMask } from '../../utils/canvas/selection/derivedLines';
import { getLineKey } from '../../types';

export function useCanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const { width, height, lines, highlights, getCellHighlightColor } = useCanvasStore();
  const { offsetX, offsetY, cellSize } = useViewportStore();
  // Subscribe to ghost so we re-render when it appears/disappears/changes.
  const ghost = useSelectionStore((s) => s.ghost);

  // Lines belonging to the active ghost's source mask are visually "lifted"
  // off the canvas — the store still holds them, but render skips them.
  const hiddenLineKeys = useMemo(() => {
    if (!ghost?.sourceMask) return null;
    const keys = new Set<string>();
    for (const line of getLinesInMask(ghost.sourceMask, lines)) {
      keys.add(getLineKey(line.x, line.y, line.orientation));
    }
    return keys;
  }, [ghost, lines]);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderCanvas(ctx, {
      canvasWidth: width,
      canvasHeight: height,
      lines,
      offsetX,
      offsetY,
      cellSize,
      getCellColor: getCellHighlightColor,
      hiddenLineKeys,
    });
    // `highlights` is intentionally listed: getCellHighlightColor reads the
    // live store via closure, so we need this dep to retrigger render when
    // highlights change without a `lines` change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, lines, highlights, offsetX, offsetY, cellSize, getCellHighlightColor, hiddenLineKeys]);

  const scheduleRender = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      render();
      rafRef.current = null;
    });
  }, [render]);

  useEffect(() => {
    scheduleRender();
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [scheduleRender]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => scheduleRender();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [scheduleRender]);

  // Handle canvas element resize (e.g., sidebar toggle)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeObserver = new ResizeObserver(() => {
      scheduleRender();
    });

    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [scheduleRender]);

  return { canvasRef, scheduleRender };
}
