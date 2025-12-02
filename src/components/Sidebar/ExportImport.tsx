import { useRef, useState } from 'react';
import { useCanvasStore, useUIStore } from '../../store';
import { exportToJSON, importFromJSON } from '../../utils/exportImport';
import { generatePDF } from '../../utils/printPDF';
import styles from './Sidebar.module.css';

export const ExportImport: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cellsPerPage, setCellsPerPage] = useState(25);

  const { width, height, lines, highlights, currentColor, getCellHighlightColor, loadScheme } = useCanvasStore();
  const { showToast } = useUIStore();

  const handleExport = () => {
    exportToJSON({
      version: 1,
      width,
      height,
      lines,
      highlights,
      currentColor,
    });
    showToast('Схема экспортирована', 'success');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const data = await importFromJSON(file);
      loadScheme(data);
      showToast('Схема загружена', 'success');
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error', 4000);
      } else {
        showToast('Ошибка загрузки файла', 'error');
      }
    }

    // Reset input to allow selecting the same file again
    e.target.value = '';
  };

  const handlePrint = () => {
    generatePDF({
      width,
      height,
      lines,
      highlights,
      getCellHighlightColor,
      cellsPerPageX: cellsPerPage,
    });
    showToast('PDF создан', 'success');
  };

  const handleCellsPerPageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (!isNaN(value) && value >= 1 && value <= 100) {
      setCellsPerPage(value);
    }
  };

  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>Файл</h3>
      <div className={styles.exportImportButtons}>
        <button className={styles.exportImportButton} onClick={handleExport}>
          Экспорт JSON
        </button>
        <button className={styles.exportImportButton} onClick={handleImportClick}>
          Загрузить JSON
        </button>
        <div className={styles.printSettings}>
          <label className={styles.printSettingsLabel}>
            Клеток на страницу:
            <input
              type="number"
              min="1"
              max="100"
              value={cellsPerPage}
              onChange={handleCellsPerPageChange}
              className={styles.printSettingsInput}
            />
          </label>
        </div>
        <button className={styles.exportImportButton} onClick={handlePrint}>
          Печать PDF
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
    </div>
  );
};
