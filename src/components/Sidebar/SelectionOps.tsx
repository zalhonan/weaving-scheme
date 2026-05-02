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
  const clipboard = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().clipboard,
  );

  if (!selection && !ghost && !clipboard) return null;

  const onMove = () => useSelectionStore.getState().beginMoveGhost();
  const onCopy = () => useSelectionStore.getState().copySelection();
  const onCut = () => useSelectionStore.getState().cutSelection();
  const onPaste = () => useSelectionStore.getState().pasteFromClipboard();
  const onConfirm = () => useSelectionStore.getState().commitGhost();
  const onCancel = () => useSelectionStore.getState().cancelGhost();

  const onDelete = () => {
    const sel = useSelectionStore.getState();
    if (!sel.selection) return;
    const canvas = useCanvasStore.getState();
    const lines = getLinesInMask(sel.selection, canvas.lines);
    if (lines.length > 0) canvas.applyDelete(lines);
    sel.clearSelection();
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Выделение</h3>
      {ghost ? (
        <div className={styles.undoRedoButtons}>
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
        </div>
      ) : (
        <>
          {selection && (
            <div className={styles.undoRedoButtons}>
              <button
                className={styles.undoRedoButton}
                onClick={onMove}
                title="Переместить (drag в выделении или стрелки)"
              >
                Двигать
              </button>
              <button
                className={styles.undoRedoButton}
                onClick={onDelete}
                title="Удалить (Del)"
              >
                Удалить
              </button>
            </div>
          )}
          <div className={styles.undoRedoButtons}>
            {selection && (
              <>
                <button
                  className={styles.undoRedoButton}
                  onClick={onCopy}
                  title="Копировать (Ctrl/⌘+C)"
                >
                  Копия
                </button>
                <button
                  className={styles.undoRedoButton}
                  onClick={onCut}
                  title="Вырезать (Ctrl/⌘+X)"
                >
                  Вырезать
                </button>
              </>
            )}
            {clipboard && (
              <button
                className={styles.undoRedoButton}
                onClick={onPaste}
                title="Вставить (Ctrl/⌘+V)"
              >
                Вставить
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
