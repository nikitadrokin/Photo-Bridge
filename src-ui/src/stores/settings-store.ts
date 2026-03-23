import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Native terminal app used when opening shell commands from the app. */
export type PreferredTerminalApp = 'ghostty' | 'terminal';

/** Select options for the terminal preference UI (value matches `PreferredTerminalApp`). */
export const TERMINAL_APP_SELECT_ITEMS: ReadonlyArray<{
  label: string;
  value: PreferredTerminalApp;
}> = [
  { label: 'Ghostty', value: 'ghostty' },
  { label: 'Terminal', value: 'terminal' },
];

interface SettingsState {
  /** Where heavy work runs: in-app log vs external terminal (future). */
  runMode: 'in-app' | 'terminal';
  setRunMode: (mode: 'in-app' | 'terminal') => void;
  /** User-chosen macOS terminal for command execution. */
  preferredTerminal: PreferredTerminalApp;
  setPreferredTerminal: (app: PreferredTerminalApp) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      runMode: 'in-app',
      setRunMode: (mode) => set({ runMode: mode }),
      preferredTerminal: 'terminal',
      setPreferredTerminal: (app) => set({ preferredTerminal: app }),
    }),
    { name: 'settings-storage' },
  ),
);
