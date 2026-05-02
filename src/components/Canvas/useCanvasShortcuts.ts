import { useEffect } from 'react';
import { useSelectionStore } from '../../store';

/**
 * Global keyboard shortcuts for the selection layer. Attached at the window
 * level so they fire even when the canvas itself is not focused. Ignores
 * input/textarea/contenteditable targets to avoid stealing typing.
 *
 * Slice A: only Escape (cancel ghost / axis-picker / clear selection).
 * Later slices grow this with Delete, Enter, arrow keys, Ctrl+C/X/V, etc.
 */
export function useCanvasShortcuts(): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const sel = useSelectionStore.getState();

      if (e.key === 'Escape') {
        if (sel.ghost) {
          sel.cancelGhost();
          e.preventDefault();
        } else if (sel.axisPicker?.active) {
          sel.cancelAxisPicker();
          e.preventDefault();
        } else if (sel.selection) {
          sel.clearSelection();
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
