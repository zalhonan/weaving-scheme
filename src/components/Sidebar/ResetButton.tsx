import { useState } from 'react';
import { useCanvasStore } from '../../store';
import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './Sidebar.module.css';

export const ResetButton: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const reset = useCanvasStore((state) => state.reset);

  const handleReset = () => {
    reset();
    setShowConfirm(false);
  };

  return (
    <div className={styles.section}>
      <Button onClick={() => setShowConfirm(true)} variant="danger">
        Очистить канву
      </Button>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Очистить канву?"
        message="Все линии будут удалены. Это действие можно отменить через Undo."
        onConfirm={handleReset}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
