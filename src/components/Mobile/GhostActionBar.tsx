import { useSyncExternalStore } from 'react';
import { useSelectionStore } from '../../store';
import styles from './GhostActionBar.module.css';

/**
 * Floating bar that appears at the bottom of the viewport while a ghost is
 * active. Provides Confirm / Cancel buttons within thumb reach, so the user
 * doesn't have to open the sidebar overlay to commit a touch-driven move /
 * flip / rotate / paste. Visible only on small screens — desktop uses the
 * Enter / Esc keyboard shortcuts and the sidebar SelectionOps section.
 *
 * The transform buttons (Flip, Rotate, Mirror) intentionally stay in the
 * sidebar for now — the user opens the menu (☰) to access them, then closes
 * it to keep composing. A future iteration could promote them here.
 */
export const GhostActionBar: React.FC = () => {
  const ghost = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().ghost,
  );
  const axisPicker = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().axisPicker,
  );

  if (axisPicker?.active) {
    return (
      <div className={styles.bar}>
        <span className={styles.hint}>Выбери ось — клик по линии сетки</span>
        <button
          className={styles.button}
          onClick={() => useSelectionStore.getState().cancelAxisPicker()}
        >
          ✗ Отмена
        </button>
      </div>
    );
  }

  if (!ghost) return null;

  return (
    <div className={styles.bar}>
      <button
        className={`${styles.button} ${styles.confirm}`}
        onClick={() => useSelectionStore.getState().commitGhost()}
      >
        ✓ Применить
      </button>
      <button
        className={styles.button}
        onClick={() => useSelectionStore.getState().cancelGhost()}
      >
        ✗ Отменить
      </button>
    </div>
  );
};
