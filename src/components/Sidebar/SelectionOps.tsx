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

  const onFlipH = () => useSelectionStore.getState().applyFlipHorizontal();
  const onFlipV = () => useSelectionStore.getState().applyFlipVertical();
  const onMirror = () => useSelectionStore.getState().beginAxisPicker();
  const onRotateCW = () => useSelectionStore.getState().applyRotate('cw');
  const onRotateCCW = () => useSelectionStore.getState().applyRotate('ccw');

  // Axis picker: dedicated state — only instruction + cancel.
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

  // Whether the transform-row buttons should be enabled. They compose onto
  // the active ghost or, if no ghost yet, lazily create one from selection.
  const canTransform = Boolean(selection || ghost);
  const showSelectionOnlyOps = Boolean(selection && !ghost);

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Выделение</h3>

      {/* Confirm / Cancel — visible while a ghost is composing. Other
          transform buttons stay enabled so the user can compose more. */}
      {ghost && (
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
      )}

      {/* Source-only ops: Move/Delete + Copy/Cut. Hidden during ghost
          (they don't compose; user must commit/cancel first). */}
      {showSelectionOnlyOps && (
        <>
          <div className={styles.undoRedoButtons}>
            <button
              className={styles.undoRedoButton}
              onClick={onMove}
              title="Поднять выделение в плавающий слой (или drag/стрелки)"
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
          <div className={styles.undoRedoButtons}>
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

      {/* Paste-only when no selection / no ghost but clipboard exists. */}
      {!selection && !ghost && clipboard && (
        <div className={styles.undoRedoButtons}>
          <button
            className={styles.undoRedoButton}
            onClick={onPaste}
            title="Вставить (Ctrl/⌘+V)"
          >
            Вставить
          </button>
        </div>
      )}

      {/* Transforms: visible whenever transformable content exists, INCLUDING
          while a ghost is composing — that's the whole point of this layout
          (compose flips + rotations + mirrors before committing). */}
      {canTransform && (
        <>
          <div className={styles.undoRedoButtons}>
            <button
              className={styles.undoRedoButton}
              onClick={onFlipH}
              title="Отразить горизонтально (вокруг центра выделения / ghost'а)"
            >
              ⇄ Flip H
            </button>
            <button
              className={styles.undoRedoButton}
              onClick={onFlipV}
              title="Отразить вертикально (вокруг центра выделения / ghost'а)"
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
