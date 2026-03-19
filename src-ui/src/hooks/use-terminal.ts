import { useCallback, useEffect, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';

type TerminalType = 'ghostty' | 'terminal' | null;

interface UseTerminalResult {
  /** Detected terminal app name */
  terminalName: string | null;
  /** Whether detection is complete */
  isReady: boolean;
  /** Open native terminal with a command */
  openInTerminal: (command: string, args: Array<string>) => Promise<void>;
  /** Get the full CLI command string for display */
  getCommandString: (command: string, args: Array<string>) => string;
}

const TERMINAL_CHECKS: Array<{
  type: TerminalType;
  path: string;
  name: string;
}> = [
  { type: 'ghostty', path: '/Applications/Ghostty.app', name: 'Ghostty' },
  {
    type: 'terminal',
    path: '/System/Applications/Utilities/Terminal.app',
    name: 'Terminal',
  },
];

/**
 * Hook for detecting and launching the user's native terminal with commands.
 */
export function useTerminal(): UseTerminalResult {
  const [terminalType, setTerminalType] = useState<TerminalType>(null);
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Detect installed terminal on mount
  useEffect(() => {
    async function detectTerminal() {
      for (const terminal of TERMINAL_CHECKS) {
        try {
          // Use 'test -d' to check if the app exists
          const cmd = Command.create('exec-sh', [
            '-c',
            `test -d "${terminal.path}"`,
          ]);
          const result = await cmd.execute();
          if (result.code === 0) {
            setTerminalType(terminal.type);
            setTerminalName(terminal.name);
            setIsReady(true);
            return;
          }
        } catch {
          // Continue to next terminal
        }
      }
      // No terminal found (shouldn't happen, Terminal.app is always there)
      setIsReady(true);
    }
    detectTerminal();
  }, []);

  const getCommandString = useCallback(
    (command: string, args: Array<string>): string => {
      const escapedArgs = args.map((arg) => {
        // Escape spaces and special characters in paths
        if (arg.includes(' ') || arg.includes("'") || arg.includes('"')) {
          return `'${arg.replace(/'/g, "'\\''")}'`;
        }
        return arg;
      });
      return `${command} ${escapedArgs.join(' ')}`;
    },
    [],
  );

  const openInTerminal = useCallback(
    async (command: string, args: Array<string>) => {
      if (!terminalType) {
        console.error('No terminal detected');
        return;
      }

      const fullCommand = getCommandString(command, args);

      try {
        if (terminalType === 'ghostty') {
          // Ghostty: use binary directly with -e flag
          // Per docs: -e flag passes command directly, auto-sets quit-after-last-window-closed=true
          const cmd = Command.create('exec-sh', [
            '-c',
            `/Applications/Ghostty.app/Contents/MacOS/ghostty -e /opt/homebrew/bin/adb shell -t "cd /sdcard/DCIM/Camera; echo 'You are in the photo library path of your device.'; echo ''; echo '  ls      - View your media'; echo '  exit    - Close the session'; echo ''; /system/bin/sh"`,
          ]);
          await cmd.execute();
        } else {
          // Terminal.app: use AppleScript
          const script = `
                    tell application "Terminal"
                        activate
                        do script "${fullCommand.replace(/"/g, '\\"')}"
                    end tell
                `;
          const cmd = Command.create('exec-sh', [
            '-c',
            `osascript -e '${script.replace(/'/g, "'\\''")}'`,
          ]);
          await cmd.execute();
        }
      } catch (error) {
        console.error('Failed to open terminal:', error);
      }
    },
    [terminalType, getCommandString],
  );

  return {
    terminalName,
    isReady,
    openInTerminal,
    getCommandString,
  };
}
