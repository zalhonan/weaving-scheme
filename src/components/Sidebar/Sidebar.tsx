import { useUIStore } from '../../store';
import { Statistics } from './Statistics';
import { ResetButton } from './ResetButton';
import { CanvasSizeControl } from './CanvasSizeControl';
import { UndoRedo } from './UndoRedo';
import { HotkeysInfo } from './HotkeysInfo';
import { ColorPalette } from './ColorPalette';
import { ExportImport } from './ExportImport';
import styles from './Sidebar.module.css';

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={`${styles.sidebar} ${sidebarCollapsed ? styles.collapsed : ''}`}
    >
      <button
        className={styles.toggleButton}
        onClick={toggleSidebar}
        aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
      >
        {sidebarCollapsed ? '›' : '‹'}
      </button>

      {!sidebarCollapsed && (
        <div className={styles.content}>
          <h2 className={styles.title}>Weaving Scheme</h2>
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
  );
};
