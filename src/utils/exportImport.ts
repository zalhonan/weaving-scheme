import { Line, CellHighlight } from '../types';
import { mapReplacer, mapReviver } from './storage';

/**
 * Schema data structure for export/import.
 */
export interface SchemeData {
  version: number;
  width: number;
  height: number;
  lines: Map<string, Line>;
  highlights: CellHighlight[];
  currentColor: string;
}

/**
 * Export scheme to JSON and trigger download.
 */
export function exportToJSON(data: SchemeData): void {
  const jsonString = JSON.stringify(data, mapReplacer, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `weaving-scheme-${Date.now()}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Import scheme from JSON file.
 * Returns parsed data or throws an error with a message.
 */
export function importFromJSON(file: File): Promise<SchemeData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content, mapReviver);

        // Validate the structure
        if (typeof parsed.width !== 'number' || parsed.width < 1) {
          throw new Error('Неверный формат: отсутствует или некорректная ширина');
        }
        if (typeof parsed.height !== 'number' || parsed.height < 1) {
          throw new Error('Неверный формат: отсутствует или некорректная высота');
        }
        if (!(parsed.lines instanceof Map)) {
          throw new Error('Неверный формат: отсутствуют линии');
        }
        if (!Array.isArray(parsed.highlights)) {
          // highlights can be missing in older exports, default to empty
          parsed.highlights = [];
        }
        if (typeof parsed.currentColor !== 'string') {
          // currentColor can be missing, default to black
          parsed.currentColor = '#000000';
        }

        resolve(parsed as SchemeData);
      } catch (error) {
        if (error instanceof SyntaxError) {
          reject(new Error('Неверный формат файла: невозможно разобрать JSON'));
        } else if (error instanceof Error) {
          reject(error);
        } else {
          reject(new Error('Неизвестная ошибка при загрузке файла'));
        }
      }
    };

    reader.onerror = () => {
      reject(new Error('Ошибка чтения файла'));
    };

    reader.readAsText(file);
  });
}
