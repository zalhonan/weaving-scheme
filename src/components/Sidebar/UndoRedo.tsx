import { useSyncExternalStore } from 'react';
import { useTemporalStore } from '../../store';
import styles from './Sidebar.module.css';

export const UndoRedo: React.FC = () => {
  const temporalStore = useTemporalStore;

  // Subscribe to temporal store for reactive updates
  const canUndo = useSyncExternalStore(
    temporalStore.subscribe,
    () => temporalStore.getState().pastStates.length > 0
  );

  const canRedo = useSyncExternalStore(
    temporalStore.subscribe,
    () => temporalStore.getState().futureStates.length > 0
  );

  const handleUndo = () => {
    temporalStore.getState().undo();
  };

  const handleRedo = () => {
    temporalStore.getState().redo();
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>История</h3>
      <div className={styles.undoRedoButtons}>
        <button
          className={styles.undoRedoButton}
          onClick={handleUndo}
          disabled={!canUndo}
          title="Отменить (Ctrl+Z)"
        >
          ↶ Отменить
        </button>
        <button
          className={styles.undoRedoButton}
          onClick={handleRedo}
          disabled={!canRedo}
          title="Повторить (Ctrl+Y)"
        >
          ↷ Повторить
        </button>
      </div>
    </div>
  );
};
