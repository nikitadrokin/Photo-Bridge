import { create } from 'zustand';

interface MediaState {
  selectedPaths: Array<string>;
  setSelectedPaths: (paths: Array<string>) => void;
  clearSelection: () => void;
}

export const useMediaStore = create<MediaState>()((set) => ({
  selectedPaths: [],
  setSelectedPaths: (paths) => set({ selectedPaths: paths }),
  clearSelection: () => set({ selectedPaths: [] }),
}));
