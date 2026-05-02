import { useSyncExternalStore } from 'react';
import { useSelectionStore } from '../../store';
import type { RefineMode, Tool } from '../../types';
import styles from './Sidebar.module.css';

const TOOLS: Array<{ id: Tool; label: string; title: string }> = [
  { id: 'draw', label: 'Рисовать', title: 'Рисование линий' },
  { id: 'select-rect', label: 'Рамка', title: 'Прямоугольное выделение' },
  { id: 'select-lasso', label: 'Лассо', title: 'Выделение лассо' },
];

const REFINE_MODES: Array<{ id: RefineMode; label: string; title: string }> = [
  { id: 'replace', label: 'Заменить', title: 'Новое выделение заменяет старое (без модификаторов)' },
  { id: 'add', label: '+ Добавить', title: 'Новое объединяется с существующим (Shift на мыши)' },
  { id: 'subtract', label: '− Убрать', title: 'Новое вычитается из существующего (Ctrl/Cmd на мыши)' },
];

export const SelectionTool: React.FC = () => {
  const tool = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().tool,
  );
  const refineMode = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().refineMode,
  );
  const setTool = useSelectionStore((s) => s.setTool);
  const setRefineMode = useSelectionStore((s) => s.setRefineMode);

  const isSelectTool = tool === 'select-rect' || tool === 'select-lasso';

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Инструмент</h3>
      <div className={styles.undoRedoButtons}>
        {TOOLS.map(({ id, label, title }) => (
          <button
            key={id}
            className={styles.undoRedoButton}
            onClick={() => setTool(id)}
            disabled={tool === id}
            title={title}
            aria-pressed={tool === id}
          >
            {label}
          </button>
        ))}
      </div>
      {isSelectTool && (
        <div className={styles.undoRedoButtons} style={{ marginTop: 8 }}>
          {REFINE_MODES.map(({ id, label, title }) => (
            <button
              key={id}
              className={styles.undoRedoButton}
              onClick={() => setRefineMode(id)}
              disabled={refineMode === id}
              title={title}
              aria-pressed={refineMode === id}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
