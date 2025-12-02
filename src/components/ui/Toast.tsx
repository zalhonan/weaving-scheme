import { useUIStore } from '../../store';
import styles from './ui.module.css';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast, sidebarCollapsed } = useUIStore();

  if (toasts.length === 0) return null;

  return (
    <div
      className={styles.toastContainer}
      style={{ left: sidebarCollapsed ? '56px' : '296px' }}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[`toast--${toast.type}`]}`}
          onClick={() => removeToast(toast.id)}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
};
