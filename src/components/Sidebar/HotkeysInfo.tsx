import { useState, useEffect } from 'react';
import styles from './Sidebar.module.css';

const desktopHotkeys = [
  { keys: 'ЛКМ', description: 'Нарисовать линию' },
  { keys: 'ПКМ', description: 'Стереть линию' },
  { keys: 'СКМ + drag', description: 'Панорамирование' },
  { keys: 'Колесо мыши', description: 'Масштабирование' },
  { keys: 'Shift + ЛКМ', description: 'Протянуть линию до границы' },
  { keys: 'Ctrl + ЛКМ', description: 'Заливка контура' },
  { keys: 'ЛКМ на номер', description: 'Закрасить строку/столбец' },
  { keys: 'ПКМ на номер', description: 'Снять закраску' },
  { keys: 'Ctrl/⌘ + Z', description: 'Отменить действие' },
  { keys: 'Ctrl/⌘ + Shift + Z', description: 'Повторить действие' },
  { keys: 'Ctrl/⌘ + Y', description: 'Повторить действие (Win)' },
  { keys: 'Del / Backspace', description: 'Удалить выделенное' },
  { keys: '↑ ↓ ← →', description: 'Сдвинуть выделение / ghost на 1 клетку' },
  { keys: 'Enter', description: 'Применить перемещение / вставку' },
  { keys: 'Esc', description: 'Отменить перемещение / снять выделение' },
  { keys: 'Ctrl/⌘ + C', description: 'Копировать выделенное' },
  { keys: 'Ctrl/⌘ + X', description: 'Вырезать выделенное' },
  { keys: 'Ctrl/⌘ + V', description: 'Вставить из буфера' },
  { keys: 'B', description: 'Инструмент: Рисовать' },
  { keys: 'V', description: 'Инструмент: Рамка' },
  { keys: 'L', description: 'Инструмент: Лассо' },
];

const mobileGestures = [
  { keys: 'Касание', description: 'Нарисовать линию' },
  { keys: 'Долгое нажатие', description: 'Стереть линию' },
  { keys: 'Провести пальцем', description: 'Рисовать непрерывно' },
  { keys: '2 пальца + движение', description: 'Панорамирование' },
  { keys: '2 пальца + pinch', description: 'Масштабирование' },
  { keys: 'Тап 2 пальцами', description: 'Отменить действие' },
  { keys: 'Тап 3 пальцами', description: 'Повторить действие' },
  { keys: 'Тап на номер', description: 'Закрасить строку/столбец' },
  { keys: 'Долгий тап на номер', description: 'Снять закраску' },
];

export const HotkeysInfo: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth <= 768;
      setIsMobile(hasTouch && isSmallScreen);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const hotkeys = isMobile ? mobileGestures : desktopHotkeys;
  const title = isMobile ? 'Жесты' : 'Горячие клавиши';

  return (
    <div className={styles.section}>
      <button
        className={styles.collapsibleHeader}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className={styles.sectionTitle}>{title}</span>
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
