import { useSyncExternalStore } from 'react';
import { useCanvasStore, useSelectionStore } from '../../store';
import { getLinesInMask } from '../../utils/canvas/selection/derivedLines';
import styles from './Sidebar.module.css';

export const SelectionOps: React.FC = () => {
  const selection = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().selection,
  );
  const ghost = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().ghost,
  );

  if (!selection && !ghost) return null;

  const onMove = () => {
    useSelectionStore.getState().beginMoveGhost();
  };

  const onDelete = () => {
    const sel = useSelectionStore.getState();
    if (!sel.selection) return;
    const canvas = useCanvasStore.getState();
    const lines = getLinesInMask(sel.selection, canvas.lines);
    if (lines.length > 0) canvas.applyDelete(lines);
    sel.clearSelection();
  };

  const onConfirm = () => {
    useSelectionStore.getState().commitGhost();
  };

  const onCancel = () => {
    useSelectionStore.getState().cancelGhost();
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Выделение</h3>
      <div className={styles.undoRedoButtons}>
        {ghost ? (
          <>
            <button
              className={styles.undoRedoButton}
              onClick={onConfirm}
              title="Применить (Enter)"
            >
              ✓ Применить
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onCancel}
              title="Отменить (Esc)"
            >
              ✗ Отменить
            </button>
          </>
        ) : (
          <>
            <button
              className={styles.undoRedoButton}
              onClick={onMove}
              title="Переместить (или drag в выделении / стрелки)"
            >
              Переместить
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onDelete}
              title="Удалить (Del)"
            >
              Удалить
            </button>
          </>
        )}
      </div>
    </div>
  );
};
