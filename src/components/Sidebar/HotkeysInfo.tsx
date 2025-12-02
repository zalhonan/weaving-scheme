import { useState } from 'react';
import styles from './Sidebar.module.css';

const hotkeys = [
  { keys: 'ЛКМ', description: 'Нарисовать линию' },
  { keys: 'ПКМ', description: 'Стереть линию' },
  { keys: 'СКМ + drag', description: 'Панорамирование' },
  { keys: 'Колесо мыши', description: 'Масштабирование' },
  { keys: 'Shift + ЛКМ', description: 'Протянуть линию до границы' },
  { keys: 'Ctrl + ЛКМ', description: 'Заливка контура' },
  { keys: 'ЛКМ на номер', description: 'Закрасить строку/столбец' },
  { keys: 'ПКМ на номер', description: 'Снять закраску' },
];

export const HotkeysInfo: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={styles.section}>
      <button
        className={styles.collapsibleHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={styles.sectionTitle}>Горячие клавиши</span>
        <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
      </button>
      {isExpanded && (
        <div className={styles.hotkeysList}>
          {hotkeys.map(({ keys, description }) => (
            <div key={keys} className={styles.hotkeyItem}>
              <span className={styles.hotkeyKeys}>{keys}</span>
              <span className={styles.hotkeyDescription}>{description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
