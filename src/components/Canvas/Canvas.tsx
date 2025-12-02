import { useCanvasRenderer } from './useCanvasRenderer';
import { useCanvasInteraction } from './useCanvasInteraction';
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

  return (
    <canvas
      ref={canvasRef}
      className={`${styles.canvas} ${isPanning ? styles.panning : ''}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onContextMenu={handleContextMenu}
      onWheel={handleWheel}
    />
  );
};
