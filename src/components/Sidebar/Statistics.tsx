import { useMemo } from 'react';
import { useCanvasStore } from '../../store';
import styles from './Sidebar.module.css';

export const Statistics: React.FC = () => {
  const width = useCanvasStore((state) => state.width);
  const height = useCanvasStore((state) => state.height);
  const lines = useCanvasStore((state) => state.lines);

  const stats = useMemo(() => {
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

    const figureWidth = lines.size > 0 ? maxX - minX + 1 : 0;
    const figureHeight = lines.size > 0 ? maxY - minY + 1 : 0;

    return {
      canvasWidth: width,
      canvasHeight: height,
      figureWidth,
      figureHeight,
      horizontalLineCount: horizontalCount,
      verticalLineCount: verticalCount,
      totalLineCount: lines.size,
    };
  }, [width, height, lines]);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Статистика</h3>
      <div className={styles.statsList}>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Размер канвы:</span>
          <span className={styles.statValue}>
            {stats.canvasWidth} × {stats.canvasHeight}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Размер фигуры:</span>
          <span className={styles.statValue}>
            {stats.totalLineCount > 0
              ? `${stats.figureWidth} × ${stats.figureHeight}`
              : '—'}
          </span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Горизонтальных линий:</span>
          <span className={styles.statValue}>{stats.horizontalLineCount}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Вертикальных линий:</span>
          <span className={styles.statValue}>{stats.verticalLineCount}</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statLabel}>Всего линий:</span>
          <span className={styles.statValue}>{stats.totalLineCount}</span>
        </div>
      </div>
    </div>
  );
};
