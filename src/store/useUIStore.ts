import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
}

interface UIStore {
  sidebarCollapsed: boolean;
  toasts: Toast[];
  // Mobile-specific state
  mobileToolbarCollapsed: boolean;
  mobileToolbarPosition: { x: number; y: number };
  showGestureHints: boolean;
  gestureOnboardingComplete: boolean;

  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  showToast: (message: string, type?: Toast['type'], duration?: number) => void;
  removeToast: (id: string) => void;
  // Mobile actions
  toggleMobileToolbar: () => void;
  setMobileToolbarPosition: (x: number, y: number) => void;
  setShowGestureHints: (show: boolean) => void;
  completeGestureOnboarding: () => void;
}

export const useUIStore = create<UIStore>()(
  persist(
    (set, get) => ({
      sidebarCollapsed: false,
      toasts: [],
      // Mobile defaults
      mobileToolbarCollapsed: false,
      mobileToolbarPosition: { x: 16, y: 100 },
      showGestureHints: false,
      gestureOnboardingComplete: false,

      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      showToast: (message, type = 'info', duration = 3000) => {
        const id = crypto.randomUUID();
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
        setTimeout(() => get().removeToast(id), duration);
      },

      removeToast: (id) =>
        set((s) => ({
          toasts: s.toasts.filter((t) => t.id !== id),
        })),

      // Mobile actions
      toggleMobileToolbar: () =>
        set((s) => ({ mobileToolbarCollapsed: !s.mobileToolbarCollapsed })),

      setMobileToolbarPosition: (x, y) =>
        set({ mobileToolbarPosition: { x, y } }),

      setShowGestureHints: (show) => set({ showGestureHints: show }),

      completeGestureOnboarding: () =>
        set({ gestureOnboardingComplete: true, showGestureHints: false }),
    }),
    {
      name: 'weaving-scheme-ui',
      partialize: (state) => ({
        gestureOnboardingComplete: state.gestureOnboardingComplete,
        mobileToolbarPosition: state.mobileToolbarPosition,
      }),
    }
  )
);
