import { useCanvasStore } from '../../store';
import { COLOR_PALETTE } from '../../constants/colors';
import styles from './Sidebar.module.css';

export const ColorPalette: React.FC = () => {
  const currentColor = useCanvasStore((state) => state.currentColor);
  const setCurrentColor = useCanvasStore((state) => state.setCurrentColor);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Цвет</h3>
      <div className={styles.colorPalette}>
        {COLOR_PALETTE.map((color) => (
          <button
            key={color}
            className={`${styles.colorSwatch} ${currentColor === color ? styles.colorSwatchSelected : ''}`}
            style={{ backgroundColor: color }}
            onClick={() => setCurrentColor(color)}
            aria-label={`Выбрать цвет ${color}`}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};
