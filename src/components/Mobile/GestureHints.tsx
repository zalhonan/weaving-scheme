import { useEffect } from 'react';
import { useUIStore } from '../../store';
import { isMobileDevice } from '../../utils/touch';
import styles from './GestureHints.module.css';

interface GestureItem {
  gesture: string;
  icon: string;
  description: string;
}

const GESTURES: GestureItem[] = [
  {
    gesture: 'Касание',
    icon: '👆',
    description: 'Нарисовать линию',
  },
  {
    gesture: 'Долгое нажатие',
    icon: '👆⏱',
    description: 'Стереть линию',
  },
  {
    gesture: 'Провести пальцем',
    icon: '👆→',
    description: 'Непрерывное рисование',
  },
  {
    gesture: 'Двумя пальцами',
    icon: '✌️',
    description: 'Перемещение и масштаб',
  },
  {
    gesture: 'Тап 2 пальцами',
    icon: '✌️👆',
    description: 'Отменить действие',
  },
  {
    gesture: 'Тап 3 пальцами',
    icon: '🖐️',
    description: 'Повторить действие',
  },
];

export const GestureHints: React.FC = () => {
  const {
    showGestureHints,
    gestureOnboardingComplete,
    setShowGestureHints,
    completeGestureOnboarding,
  } = useUIStore();

  // Auto-show onboarding for mobile users on first visit
  useEffect(() => {
    if (!gestureOnboardingComplete && isMobileDevice()) {
      // Small delay to let the app render first
      const timer = setTimeout(() => {
        setShowGestureHints(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [gestureOnboardingComplete, setShowGestureHints]);

  if (!showGestureHints) return null;

  const handleClose = () => {
    setShowGestureHints(false);
    if (!gestureOnboardingComplete) {
      completeGestureOnboarding();
    }
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Управление жестами</h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ✕
          </button>
        </div>

        <div className={styles.content}>
          {GESTURES.map((item, index) => (
            <div key={index} className={styles.gestureItem}>
              <div className={styles.gestureIcon}>{item.icon}</div>
              <div className={styles.gestureInfo}>
                <div className={styles.gestureName}>{item.gesture}</div>
                <div className={styles.gestureDescription}>{item.description}</div>
              </div>
            </div>
          ))}
        </div>

        <button className={styles.gotItButton} onClick={handleClose}>
          Понятно!
        </button>
      </div>
    </div>
  );
};
