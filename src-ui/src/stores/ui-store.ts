import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  logViewerHeight: number;
  setLogViewerHeight: (h: number) => void;
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      logViewerHeight: 320,
      setLogViewerHeight: (h: number) =>
        set({ logViewerHeight: Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, h)) }),
    }),
    { name: 'ui-storage' },
  ),
);
