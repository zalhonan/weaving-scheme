import { useEffect, useRef, useCallback } from 'react';
import { useCanvasStore, useViewportStore } from '../../store';
import { renderCanvas } from '../../utils/canvas/renderer';

export function useCanvasRenderer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const { width, height, lines, highlights, getCellHighlightColor } = useCanvasStore();
  const { offsetX, offsetY, cellSize } = useViewportStore();

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
    });
  }, [width, height, lines, highlights, offsetX, offsetY, cellSize, getCellHighlightColor]);

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
