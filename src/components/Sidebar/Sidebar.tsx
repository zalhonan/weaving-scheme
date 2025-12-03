import { useEffect, useCallback, useState } from 'react';
import { useUIStore } from '../../store';
import { Statistics } from './Statistics';
import { ResetButton } from './ResetButton';
import { CanvasSizeControl } from './CanvasSizeControl';
import { UndoRedo } from './UndoRedo';
import { HotkeysInfo } from './HotkeysInfo';
import { ColorPalette } from './ColorPalette';
import { ExportImport } from './ExportImport';
import config from '../../../config.json';
import styles from './Sidebar.module.css';

// Helper to check if we're on mobile
const useIsMobile = () => {
  const checkMobile = () => window.innerWidth <= 768;
  const [isMobile, setIsMobile] = useState(checkMobile());

  useEffect(() => {
    const handleResize = () => setIsMobile(checkMobile());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return isMobile;
};

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUIStore();
  const isMobile = useIsMobile();

  // On mobile, "collapsed" means closed (hidden)
  // On desktop, "collapsed" means narrow strip
  const isOpen = !sidebarCollapsed;

  const handleClose = useCallback(() => {
    setSidebarCollapsed(true);
  }, [setSidebarCollapsed]);

  // Close sidebar when clicking backdrop on mobile
  const handleBackdropClick = useCallback(() => {
    if (isMobile) {
      handleClose();
    }
  }, [isMobile, handleClose]);

  // Build class names
  const sidebarClasses = [
    styles.sidebar,
    sidebarCollapsed && styles.collapsed,
    isMobile && isOpen && styles.open,
  ]
    .filter(Boolean)
    .join(' ');

  const backdropClasses = [
    styles.mobileBackdrop,
    isMobile && isOpen && styles.visible,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      {/* Mobile backdrop */}
      <div className={backdropClasses} onClick={handleBackdropClick} />

      <aside className={sidebarClasses}>
        {/* Desktop toggle button */}
        <button
          className={styles.toggleButton}
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>

        {/* Mobile close button */}
        <button
          className={styles.mobileCloseButton}
          onClick={handleClose}
          aria-label="Закрыть меню"
        >
          ✕
        </button>

        {(isOpen || !isMobile) && !sidebarCollapsed && (
          <div className={styles.content}>
            <h2 className={styles.title}>Weaving Scheme</h2>
            <span className={styles.version}>{config.version}</span>
            <ColorPalette />
            <Statistics />
            <CanvasSizeControl />
            <UndoRedo />
            <ExportImport />
            <ResetButton />
            <HotkeysInfo />
          </div>
        )}
      </aside>
    </>
  );
};
