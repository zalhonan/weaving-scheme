import { useSyncExternalStore } from 'react';
import { useSelectionStore } from '../../store';
import type { Tool } from '../../types';
import styles from './Sidebar.module.css';

const TOOLS: Array<{ id: Tool; label: string; title: string }> = [
  { id: 'draw', label: 'Рисовать', title: 'Рисование линий (B)' },
  { id: 'select-rect', label: 'Рамка', title: 'Прямоугольное выделение (V)' },
  { id: 'select-lasso', label: 'Лассо', title: 'Выделение лассо (L)' },
];

export const SelectionTool: React.FC = () => {
  const tool = useSyncExternalStore(
    useSelectionStore.subscribe,
    () => useSelectionStore.getState().tool,
  );
  const setTool = useSelectionStore((s) => s.setTool);

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
    </div>
  );
};
