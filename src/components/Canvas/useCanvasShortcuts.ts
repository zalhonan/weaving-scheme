import { useEffect } from 'react';
import {
  useCanvasStore,
  useSelectionStore,
  useTemporalStore,
} from '../../store';
import { getLinesInMask } from '../../utils/canvas/selection/derivedLines';

const arrowDelta = (key: string): { dx: number; dy: number } | null => {
  switch (key) {
    case 'ArrowUp':
      return { dx: 0, dy: -1 };
    case 'ArrowDown':
      return { dx: 0, dy: 1 };
    case 'ArrowLeft':
      return { dx: -1, dy: 0 };
    case 'ArrowRight':
      return { dx: 1, dy: 0 };
    default:
      return null;
  }
};

/**
 * Global keyboard shortcuts for the selection layer. Attached at the window
 * level so they fire even when the canvas itself is not focused. Ignores
 * input/textarea/contenteditable targets to avoid stealing typing.
 *
 * Shortcuts:
 *   Escape          cancel ghost / axis-picker / clear selection
 *   Delete | Backspace   delete lines belonging to the selection
 *   Enter           commit active ghost
 *   Arrow keys      nudge ghost (or start move-ghost from selection) by 1 cell
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
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Undo: Ctrl+Z / Cmd+Z. Redo: Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y / Cmd+Y.
      if (isMod && key === 'z') {
        if (e.shiftKey) {
          useTemporalStore.getState().redo();
        } else {
          useTemporalStore.getState().undo();
        }
        useSelectionStore.getState().clearAll();
        e.preventDefault();
        return;
      }
      if (isMod && key === 'y') {
        useTemporalStore.getState().redo();
        useSelectionStore.getState().clearAll();
        e.preventDefault();
        return;
      }

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
        return;
      }

      if (e.key === 'Enter') {
        if (sel.ghost) {
          sel.commitGhost();
          e.preventDefault();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel.selection && !sel.ghost) {
          const canvas = useCanvasStore.getState();
          const lines = getLinesInMask(sel.selection, canvas.lines);
          if (lines.length > 0) {
            canvas.applyDelete(lines);
          }
          sel.clearSelection();
          e.preventDefault();
        }
        return;
      }

      const delta = arrowDelta(e.key);
      if (delta) {
        if (sel.ghost) {
          sel.adjustGhost(delta.dx, delta.dy);
          e.preventDefault();
        } else if (sel.selection) {
          sel.beginMoveGhost();
          // beginMoveGhost may no-op if selection has no lines.
          if (useSelectionStore.getState().ghost) {
            useSelectionStore.getState().adjustGhost(delta.dx, delta.dy);
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
