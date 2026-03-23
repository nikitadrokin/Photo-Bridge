import { useCallback, useEffect, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { shJoin, shLines, shSingleQuote } from '@/lib/shell-formatters';
import { useSettingsStore } from '@/stores/settings-store';

type TerminalType = 'ghostty' | 'terminal' | null;

interface TerminalMeta {
  type: TerminalType;
  path: string;
  name: string;
}

interface UseTerminalResult {
  /** Resolved terminal app name for display */
  terminalName: string | null;
  /** Whether detection is complete */
  isReady: boolean;
  /** Open native terminal with a command */
  openInTerminal: (command: string, args: Array<string>) => Promise<void>;
  /** Get the full CLI command string for display */
  getCommandString: (command: string, args: Array<string>) => string;
}

const TERMINAL_CHECKS: Array<TerminalMeta> = [
  { type: 'ghostty', path: '/Applications/Ghostty.app', name: 'Ghostty' },
  {
    type: 'terminal',
    path: '/System/Applications/Utilities/Terminal.app',
    name: 'Terminal',
  },
];

async function directoryExists(path: string): Promise<boolean> {
  try {
    const cmd = Command.create('exec-sh', [
      '-c',
      `test -d "${path}"`,
    ]);
    const result = await cmd.execute();
    return result.code === 0;
  } catch {
    return false;
  }
}

async function firstInstalledTerminal(
  preference: 'ghostty' | 'terminal',
): Promise<TerminalMeta | null> {
  const order: Array<'ghostty' | 'terminal'> =
    preference === 'ghostty'
      ? ['ghostty', 'terminal']
      : ['terminal', 'ghostty'];

  for (const type of order) {
    const meta = TERMINAL_CHECKS.find((t) => t.type === type);
    if (meta && (await directoryExists(meta.path))) {
      return meta;
    }
  }

  return null;
}

/**
 * Detects the user’s terminal (respecting Settings) and opens commands in it.
 */
export function useTerminal(): UseTerminalResult {
  const preferredTerminal = useSettingsStore((s) => s.preferredTerminal);
  const [terminalType, setTerminalType] = useState<TerminalType>(null);
  const [terminalName, setTerminalName] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function detectTerminal() {
      setIsReady(false);
      const resolved = await firstInstalledTerminal(preferredTerminal);

      if (cancelled) {
        return;
      }

      if (resolved) {
        setTerminalType(resolved.type);
        setTerminalName(resolved.name);
      } else {
        setTerminalType(null);
        setTerminalName(null);
      }

      setIsReady(true);
    }

    void detectTerminal();

    return () => {
      cancelled = true;
    };
  }, [preferredTerminal]);

  const getCommandString = useCallback(
    (command: string, args: Array<string>): string => {
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
          const introBanner = shLines`
            You are in the photo library path of your device.

              ls                      - View your photos and videos
              df -h .                 - View "disk free" available storage
              du -sh .                - View "disk usage" of the photo library
              find . -type f | wc -l  - Count the number of files in the photo library
              exit                    - Close the session

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
