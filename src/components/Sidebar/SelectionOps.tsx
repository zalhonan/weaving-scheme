import { useSyncExternalStore } from 'react';
import { useCanvasStore, useSelectionStore } from '../../store';
import { getLinesInMask } from '../../utils/canvas/selection/derivedLines';
import { bbox } from '../../utils/canvas/selection/maskUtils';
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
  const axisPicker = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().axisPicker,
  );

  if (!selection && !ghost && !clipboard && !axisPicker) return null;

  const onMove = () => useSelectionStore.getState().beginMoveGhost();
  const onCopy = () => useSelectionStore.getState().copySelection();
  const onCut = () => useSelectionStore.getState().cutSelection();
  const onPaste = () => useSelectionStore.getState().pasteFromClipboard();
  const onConfirm = () => useSelectionStore.getState().commitGhost();
  const onCancel = () => useSelectionStore.getState().cancelGhost();
  const onCancelAxisPicker = () =>
    useSelectionStore.getState().cancelAxisPicker();

  const onDelete = () => {
    const sel = useSelectionStore.getState();
    if (!sel.selection) return;
    const canvas = useCanvasStore.getState();
    const lines = getLinesInMask(sel.selection, canvas.lines);
    if (lines.length > 0) canvas.applyDelete(lines);
    sel.clearSelection();
  };

  const onFlipH = () => {
    const sel = useSelectionStore.getState();
    if (!sel.selection) return;
    const b = bbox(sel.selection);
    if (!b) return;
    sel.beginMirrorGhost({
      orientation: 'vertical',
      x: b.minX + b.width / 2,
    });
  };

  const onFlipV = () => {
    const sel = useSelectionStore.getState();
    if (!sel.selection) return;
    const b = bbox(sel.selection);
    if (!b) return;
    sel.beginMirrorGhost({
      orientation: 'horizontal',
      y: b.minY + b.height / 2,
    });
  };

  const onMirror = () => useSelectionStore.getState().beginAxisPicker();

  const onRotateCW = () =>
    useSelectionStore.getState().beginRotateGhost('cw');
  const onRotateCCW = () =>
    useSelectionStore.getState().beginRotateGhost('ccw');

  // Axis picker mode: show instruction + cancel only.
  if (axisPicker?.active) {
    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Выбор оси</h3>
        <p style={{ fontSize: 12, color: '#666', margin: '4px 0 8px' }}>
          Кликни на горизонтальную или вертикальную линию сетки
        </p>
        <div className={styles.undoRedoButtons}>
          <button
            className={styles.undoRedoButton}
            onClick={onCancelAxisPicker}
            title="Отмена (Esc)"
          >
            ✗ Отмена
          </button>
        </div>
      </div>
    );
  }

  // Ghost active: confirm/cancel only.
  if (ghost) {
    return (
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>Выделение</h3>
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
      </div>
    );
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Выделение</h3>
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
      {selection && (
        <>
          <div className={styles.undoRedoButtons}>
            <button
              className={styles.undoRedoButton}
              onClick={onFlipH}
              title="Отразить горизонтально (вокруг центра выделения)"
            >
              ⇄ Flip H
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onFlipV}
              title="Отразить вертикально (вокруг центра выделения)"
            >
              ⇅ Flip V
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onMirror}
              title="Зеркало по выбранной оси"
            >
              По оси
            </button>
          </div>
          <div className={styles.undoRedoButtons}>
            <button
              className={styles.undoRedoButton}
              onClick={onRotateCCW}
              title="Повернуть на 90° против часовой"
            >
              ↺ 90°
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onRotateCW}
              title="Повернуть на 90° по часовой"
            >
              ↻ 90°
            </button>
          </div>
        </>
      )}
    </div>
  );
};
