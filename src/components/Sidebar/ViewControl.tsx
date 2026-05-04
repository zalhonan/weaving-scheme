import { useViewportStore } from '../../store';
import styles from './Sidebar.module.css';

export const ViewControl: React.FC = () => {
  const fitToView = useViewportStore((state) => state.fitToView);

  const handleFit = () => {
    // Main grid canvas is the first <canvas> in the DOM (the overlay is
    // stacked on top of it, declared after). Both share the same client
    // dims, but querying the first match keeps the dependency obvious.
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    fitToView(canvas.clientWidth, canvas.clientHeight);
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Вид</h3>
      <div className={styles.undoRedoButtons}>
        <button
          className={styles.undoRedoButton}
          onClick={handleFit}
          title="Вписать канву в экран (0)"
        >
          ⤢ Вписать в экран
        </button>
      </div>
    </div>
  );
};
