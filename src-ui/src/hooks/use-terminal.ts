import { useCallback, useEffect, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import {
  NATIVE_TERMINALS,
  type NativeTerminal,
  type TerminalCommand,
} from '@/lib/native-terminals';
import { shSingleQuote } from '@/lib/shell-formatters';
import { useSettingsStore } from '@/stores/settings-store';

interface UseTerminalResult {
  /** Resolved terminal app name for display */
  terminalName: string | null;
  /** Whether detection is complete */
  isReady: boolean;
  /** Open native terminal with shell code or a command/arg pair */
  openInTerminal: (target: TerminalCommand) => Promise<void>;
  /** Get the full CLI command string for display */
  getCommandString: (command: string, args?: Array<string>) => string;
}

async function directoryExists(path: string): Promise<boolean> {
  try {
    const cmd = Command.create('exec-sh', [
      '-c',
      `test -d ${shSingleQuote(path)}`,
    ]);
    const result = await cmd.execute();
    return result.code === 0;
  } catch {
    return false;
  }
}

async function firstInstalledTerminal(
  preference: 'ghostty' | 'terminal',
): Promise<NativeTerminal | null> {
  const order: Array<'ghostty' | 'terminal'> =
    preference === 'ghostty'
      ? ['ghostty', 'terminal']
      : ['terminal', 'ghostty'];

  for (const type of order) {
    const meta = NATIVE_TERMINALS.find((terminal) => terminal.type === type);
    if (meta && (await directoryExists(meta.appPath))) {
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
  const [terminal, setTerminal] = useState<NativeTerminal | null>(null);
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
        setTerminal(resolved);
      } else {
        setTerminal(null);
      }

      setIsReady(true);
    }

    void detectTerminal();

    return () => {
      cancelled = true;
    };
  }, [preferredTerminal]);

  const getCommandString = useCallback(
    (command: string, args: Array<string> = []): string => {
      return [
        shSingleQuote(command),
        ...args.map((arg) => shSingleQuote(arg)),
      ].join(' ');
    },
    [],
  );

  const openInTerminal = useCallback(
    async (target: TerminalCommand) => {
      if (!terminal) {
        console.error('No terminal detected');
        return;
      }

      const terminalScript = getCommandString(
        target.command,
        target.args ?? [],
      );

      try {
        const launchCommand = terminal.buildLaunchCommand(terminalScript);
        const hostScript = getCommandString(
          launchCommand.command,
          launchCommand.args ?? [],
        );
        const cmd = Command.create('exec-sh', ['-c', hostScript]);
        await cmd.execute();
      } catch (error) {
        console.error('Failed to open terminal:', error);
      }
    },
    [terminal, getCommandString],
  );

  return {
    terminalName: terminal?.name ?? null,
    isReady,
    openInTerminal,
    getCommandString,
  };
}
