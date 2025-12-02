import { useEffect } from 'react';
import { useCanvasRenderer } from './useCanvasRenderer';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useCanvasTouchInteraction } from './useCanvasTouchInteraction';
import styles from './Canvas.module.css';

export const Canvas: React.FC = () => {
  const { canvasRef } = useCanvasRenderer();
  const {
    isPanning,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
    handleWheel,
  } = useCanvasInteraction(canvasRef);

  const {
    touchMode,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  } = useCanvasTouchInteraction(canvasRef);

  // Add non-passive event listeners for touch and wheel events
  // This allows preventDefault() to work properly
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Touch events need passive: false to allow preventDefault
    const touchStartHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleTouchStart(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };
    const touchMoveHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleTouchMove(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };
    const touchEndHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleTouchEnd(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };
    const touchCancelHandler = (e: TouchEvent) => {
      e.preventDefault();
      handleTouchCancel(e as unknown as React.TouchEvent<HTMLCanvasElement>);
    };

    // Wheel event needs passive: false to prevent page scroll during zoom
    const wheelHandler = (e: WheelEvent) => {
      e.preventDefault();
      handleWheel(e as unknown as React.WheelEvent<HTMLCanvasElement>);
    };

    canvas.addEventListener('touchstart', touchStartHandler, { passive: false });
    canvas.addEventListener('touchmove', touchMoveHandler, { passive: false });
    canvas.addEventListener('touchend', touchEndHandler, { passive: false });
    canvas.addEventListener('touchcancel', touchCancelHandler, { passive: false });
    canvas.addEventListener('wheel', wheelHandler, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', touchStartHandler);
      canvas.removeEventListener('touchmove', touchMoveHandler);
      canvas.removeEventListener('touchend', touchEndHandler);
      canvas.removeEventListener('touchcancel', touchCancelHandler);
      canvas.removeEventListener('wheel', wheelHandler);
    };
  }, [canvasRef, handleTouchStart, handleTouchMove, handleTouchEnd, handleTouchCancel, handleWheel]);

  // Build class names
  const classNames = [
    styles.canvas,
    isPanning && styles.panning,
    touchMode === 'drawing' && styles.touchDrawing,
    touchMode === 'erasing' && styles.touchErasing,
    touchMode === 'panning' && styles.panning,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <canvas
      ref={canvasRef}
      className={classNames}
      // Mouse events (desktop)
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      // Note: wheel and touch events are attached via useEffect with passive: false
    />
  );
};
