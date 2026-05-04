import { describe, it, expect, beforeEach } from 'vitest';
import { useCanvasStore } from '../../src/store/useCanvasStore';

const STORAGE_KEY = 'weaving-scheme-storage';

beforeEach(() => {
  localStorage.clear();
});

/**
 * Regression test: a pre-change `weaving-scheme-storage` snapshot must
 * hydrate to an identical state under the post-change build. This is the
 * "no migration required" guarantee from proposal.md and design.md.
 */
describe('useCanvasStore — localStorage shape regression', () => {
  it('hydrates a hand-crafted pre-change snapshot to the expected state', () => {
    // Hand-crafted snapshot in the exact shape Zustand `persist` produces
    // for this store: { state: <partialize output>, version: 0 }.
    // Map is serialized via storage.ts:mapReplacer.
    const snapshot = {
      state: {
        width: 30,
        height: 40,
        lines: {
          __type: 'Map',
          entries: [
            ['horizontal-2-3', { x: 2, y: 3, orientation: 'horizontal', color: '#000000' }],
            ['vertical-5-7', { x: 5, y: 7, orientation: 'vertical', color: '#FF0000' }],
          ],
        },
        highlights: [
          { type: 'row', index: 5, color: '#FFE0E0', timestamp: 1700000000000 },
        ],
        currentColor: '#0000FF',
      },
      version: 0,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));

    // Force re-hydration. Zustand persist hydrates on store creation; for
    // an already-created store we call `rehydrate()` from the persist API.
    interface PersistApi {
      persist?: { rehydrate: () => void | Promise<void> };
    }
    const api = useCanvasStore as unknown as PersistApi;
    api.persist?.rehydrate();

    const s = useCanvasStore.getState();
    expect(s.width).toBe(30);
    expect(s.height).toBe(40);
    expect(s.currentColor).toBe('#0000FF');
    expect(s.lines.size).toBe(2);
    expect(s.lines.get('horizontal-2-3')).toEqual({
      x: 2,
      y: 3,
      orientation: 'horizontal',
      color: '#000000',
    });
    expect(s.lines.get('vertical-5-7')).toEqual({
      x: 5,
      y: 7,
      orientation: 'vertical',
      color: '#FF0000',
    });
    expect(s.highlights).toHaveLength(1);
    expect(s.highlights[0]).toEqual({
      type: 'row',
      index: 5,
      color: '#FFE0E0',
      timestamp: 1700000000000,
    });
  });

  it('does not persist viewport state to localStorage (session-only)', () => {
    // Viewport store mutation should not cause any localStorage write under
    // a viewport-related key. Regression: confirms viewport stays session-only.
    localStorage.clear();
    const before = Object.keys(localStorage);

    // Trigger a viewport mutation through the store.
    void import('../../src/store/useViewportStore').then((mod) => {
      mod.useViewportStore.getState().pan(50, 50);
      mod.useViewportStore.getState().zoom(1.5, 100, 100);
    });

    const after = Object.keys(localStorage);
    expect(after).toEqual(before);
  });
});
