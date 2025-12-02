import { useCanvasStore } from '../../store';
import { COLOR_PALETTE, ERASER_TOOL } from '../../constants/colors';
import styles from './Sidebar.module.css';

export const ColorPalette: React.FC = () => {
  const currentColor = useCanvasStore((state) => state.currentColor);
  const setCurrentColor = useCanvasStore((state) => state.setCurrentColor);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Цвет</h3>
      <div className={styles.colorPalette}>
        {COLOR_PALETTE.map((color) => {
          const isEraser = color === ERASER_TOOL;
          return (
            <button
              key={color}
              className={`${styles.colorSwatch} ${currentColor === color ? styles.colorSwatchSelected : ''} ${isEraser ? styles.eraserSwatch : ''}`}
              style={isEraser ? { backgroundColor: '#FFFFFF' } : { backgroundColor: color }}
              onClick={() => setCurrentColor(color)}
              aria-label={isEraser ? 'Ластик' : `Выбрать цвет ${color}`}
              title={isEraser ? 'Ластик' : color}
            >
              {isEraser && (
                <svg
                  className={styles.eraserIcon}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 20H7L3 16C2.5 15.5 2.5 14.5 3 14L13 4C13.5 3.5 14.5 3.5 15 4L21 10C21.5 10.5 21.5 11.5 21 12L13 20" />
                  <path d="M6 11L13 18" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
