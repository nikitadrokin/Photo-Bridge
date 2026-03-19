import { useCallback, useEffect, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { shJoin, shLines, shSingleQuote } from '@/lib/shell-formatters';

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
      // Quote every token so the returned string is safe both for display and
      // for execution via `sh -c`.
      return [
        shSingleQuote(command),
        ...args.map((arg) => shSingleQuote(arg)),
      ].join(' ');
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
          // Ghostty: use binary directly with -e flag.
          //
          // Important: the remote Android script must be passed to `adb shell -t`
          // as ONE argument. Do not split it across `sh`, `-c`, and the script,
          // because `adb shell` flattens argv before sending it to the device.
          //
          // NOTE: this branch is still intentionally hardcoded to the adb photo
          // library session — command/args are ignored here.
          const introBanner = shLines`
            You are in the photo library path of your device.

              ls       - View your photos and videos
              df -h .  - View "disk free" available storage
              du -sh . - View "disk usage" of the photo library
              exit     - Close the session

          `;

          const adbRemoteScript = shJoin([
            'cd /sdcard/DCIM/Camera',
            introBanner,
            'exec /system/bin/sh',
          ]);

          const hostScript = getCommandString(
            '/Applications/Ghostty.app/Contents/MacOS/ghostty',
            ['-e', '/opt/homebrew/bin/adb', 'shell', '-t', adbRemoteScript],
          );

          const cmd = Command.create('exec-sh', ['-c', hostScript]);
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
