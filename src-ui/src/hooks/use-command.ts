import { useCallback, useRef, useState } from 'react';
import { Command } from '@tauri-apps/plugin-shell';
import { type EventV1, parseLineFromCLI } from '@cli-protocol';
import type { LogMessage } from '@/lib/types';

interface UseCommandOptions {
  /** Sidecar binary path */
  sidecar: string;
}

/** Options for {@link UseCommandResult.execute}. */
export interface ExecuteCommandOptions {
  /** Called once when the process exits, errors, or fails to start. */
  onFinish?: (code: number) => void;
  /**
   * When false, does not set global {@link UseCommandResult.isRunning}.
   * Use for lightweight background checks so the UI stays available.
   */
  trackRunning?: boolean;
}

interface UseCommandResult {
  /** Execute the command with given args */
  execute: (
    args: Array<string>,
    options?: ExecuteCommandOptions,
  ) => Promise<void>;
  /** Whether the command is currently running */
  isRunning: boolean;
  /** Log messages from stdout/stderr (legacy JSON or non-JSON lines) */
  logs: Array<LogMessage>;
  /** Structured UI events from `--jsonl` sidecar output */
  activityEvents: Array<EventV1>;
  /** Clear logs and activity */
  clearLogs: () => void;
}

/**
 * Hook for executing Tauri sidecar commands with log streaming.
 */
export function useCommand({ sidecar }: UseCommandOptions): UseCommandResult {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<Array<LogMessage>>([]);
  const [activityEvents, setActivityEvents] = useState<Array<EventV1>>([]);
  const stdoutBufferRef = useRef('');

  const clearLogs = useCallback(() => {
    setLogs([]);
    setActivityEvents([]);
    stdoutBufferRef.current = '';
  }, []);

  const addLog = useCallback((log: LogMessage) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  const addActivity = useCallback((event: EventV1) => {
    setActivityEvents((prev) => [...prev, event]);
  }, []);

  const flushStdoutLines = useCallback(
    (chunk: string) => {
      stdoutBufferRef.current += chunk;
      const buf = stdoutBufferRef.current;
      const parts = buf.split('\n');
      stdoutBufferRef.current = parts.pop() ?? '';
      for (const line of parts) {
        const parsed = parseLineFromCLI(line);
        if (parsed.tag === 'ui') {
          addActivity(parsed.event);
        } else if (parsed.tag === 'legacy') {
          addLog({
            type: parsed.log.type,
            message: parsed.log.message,
          });
        } else if (parsed.text.length > 0) {
          addLog({ type: 'log', message: parsed.text });
        }
      }
    },
    [addActivity, addLog],
  );

  const execute = useCallback(
    async (args: Array<string>, options?: ExecuteCommandOptions) => {
      const trackRunning = options?.trackRunning !== false;
      const isJsonl = args.includes('--jsonl');
      let completed = false;

      const complete = (code: number) => {
        if (completed) {
          return;
        }
        completed = true;
        if (trackRunning) {
          setIsRunning(false);
        }
        options?.onFinish?.(code);
      };

      if (trackRunning) {
        setIsRunning(true);
      }
      stdoutBufferRef.current = '';

      if (!isJsonl) {
        addLog({ type: 'info', message: 'Starting process...' });
      }

      try {
        const command = Command.sidecar(sidecar, args);

        command.stdout.on('data', (line) => {
          flushStdoutLines(line);
        });

        command.stderr.on('data', (line) => {
          addLog({ type: 'error', message: line });
        });

        await command.spawn();

        command.on('close', (data) => {
          const rest = stdoutBufferRef.current;
          stdoutBufferRef.current = '';
          if (rest.trim().length > 0) {
            const parsed = parseLineFromCLI(rest);
            if (parsed.tag === 'ui') {
              addActivity(parsed.event);
            } else if (parsed.tag === 'legacy') {
              addLog({
                type: parsed.log.type,
                message: parsed.log.message,
              });
            } else if (parsed.text.length > 0) {
              addLog({ type: 'log', message: parsed.text });
            }
          }
          if (!isJsonl) {
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
          }
          complete(data.code ?? -1);
        });

        command.on('error', (error) => {
          addLog({ type: 'error', message: `Process error: ${error}` });
          complete(-1);
        });
      } catch (err) {
        console.error(err);
        addLog({
          type: 'error',
          message: `Failed to start process: ${String(err)}`,
        });
        complete(-1);
      }
    },
    [sidecar, addLog, addActivity, flushStdoutLines],
  );

  return {
    execute,
    isRunning,
    logs,
    activityEvents,
    clearLogs,
  };
}
