import { useCallback, useEffect, useRef, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import type { LogMessage } from '@/lib/types';

interface UseCommandOptions {
  /** Sidecar binary path */
  sidecar: string;
}

interface UseCommandResult {
  /** Execute the command with given args */
  execute: (
    args: Array<string>,
    options?: { onFinish?: (code: number) => void },
  ) => Promise<void>;
  /** Whether the command is currently running */
  isRunning: boolean;
  /** Log messages from stdout/stderr */
  logs: Array<LogMessage>;
  /** Clear all logs */
  clearLogs: () => void;
  /** Ref for auto-scrolling */
  logsEndRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook for executing Tauri sidecar commands with log streaming.
 */
export function useCommand({ sidecar }: UseCommandOptions): UseCommandResult {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<LogMessage>>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [logs, scrollToBottom]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const addLog = useCallback((log: LogMessage) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  const execute = useCallback(
    async (
      args: Array<string>,
      options?: { onFinish?: (code: number) => void },
    ) => {
      setIsRunning(true);
      addLog({ type: 'info', message: 'Starting process...' });

      try {
        const command = Command.sidecar(sidecar, args);

        command.stdout.on('data', (line) => {
          try {
            const msg = JSON.parse(line) as LogMessage;
            addLog(msg);
          } catch {
            addLog({ type: 'log', message: line });
          }
        });

        command.stderr.on('data', (line) => {
          addLog({ type: 'error', message: line });
        });

        await command.spawn();

        command.on('close', (data) => {
          setIsRunning(false);
          if (data.code === 0) {
            addLog({
              type: 'success',
              message: 'Process finished successfully.',
            });
          } else {
            addLog({
              type: 'error',
              message: `Process finished with code ${data.code}`,
            });
          }
          if (options?.onFinish) {
            options.onFinish(data.code ?? -1);
          }
        });

        command.on('error', (error) => {
          setIsRunning(false);
          addLog({ type: 'error', message: `Process error: ${error}` });
        });
      } catch (err) {
        console.error(err);
        setIsRunning(false);
        addLog({
          type: 'error',
          message: `Failed to start process: ${String(err)}`,
        });
      }
    },
    [sidecar, addLog],
  );

  return {
    execute,
    isRunning,
    logs,
    clearLogs,
    logsEndRef,
  };
}
