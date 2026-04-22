import kleur from 'kleur';
import type { EventV1 } from '../../types/protocol.js';

/**
 * Writes one versioned event as a single stdout line.
 * Use only in JSONL runs; human mode should use {@link textLog} instead.
 */
export function writeJsonlEvent(event: EventV1): void {
  console.log(JSON.stringify(event));
}

/** Styled, human-readable lines on stdout. */
export const textLog = {
  error(...parts: Array<unknown>) {
    console.log(kleur.red(parts.join(' ')));
  },
  warn(...parts: Array<unknown>) {
    console.log(kleur.yellow(parts.join(' ')));
  },
  info(...parts: Array<unknown>) {
    console.log(kleur.cyan(parts.join(' ')));
  },
  success(...parts: Array<unknown>) {
    console.log(kleur.green(parts.join(' ')));
  },
  log(...parts: Array<unknown>) {
    console.log(parts.join(' '));
  },
  secondary(...parts: Array<unknown>) {
    console.log(kleur.dim(parts.join(' ')));
  },
  muted(...parts: Array<unknown>) {
    console.log(kleur.dim(' ' + parts.join(' ')));
  },
  blankLine() {
    console.log();
  },
};

/**
 * Output for one CLI invocation: either {@link textLog} or {@link writeJsonlEvent}
 * with mapped severities, plus passthrough {@link CliOutput.event} for full `EventV1` rows.
 */
export interface CliOutput {
  /** When true, user-facing helpers emit NDJSON instead of styled text. */
  readonly jsonl: boolean;
  success(message: string): void;
  /** `code` is required for machine-readable severity rows; defaults for plain messages. */
  error(message: string, code?: string): void;
  warn(message: string, code?: string): void;
  info(message: string): void;
  log(message: string): void;
  secondary(message: string): void;
  indentedMuted(message: string): void;
  /** Visual spacer; no-op in JSONL mode so stdout stays parseable lines only. */
  blankLine(): void;
  /** Emit any `EventV1` (session, file, progress, …); no-op when not `jsonl`. */
  event(event: EventV1): void;
}

/**
 * Single branching point per helper: pass the result into commands instead of a global mode.
 */
export function createCliOutput(jsonl: boolean): CliOutput {
  return {
    jsonl,
    success(message: string) {
      if (jsonl) {
        writeJsonlEvent({ v: 1, kind: 'success', message });
      } else {
        textLog.success(message);
      }
    },
    error(message: string, code = 'cli_error') {
      if (jsonl) {
        writeJsonlEvent({ v: 1, kind: 'error', code, detail: message });
      } else {
        textLog.error(message);
      }
    },
    warn(message: string, code = 'cli_warn') {
      if (jsonl) {
        writeJsonlEvent({ v: 1, kind: 'warn', code, detail: message });
      } else {
        textLog.warn(message);
      }
    },
    info(message: string) {
      if (jsonl) {
        writeJsonlEvent({ v: 1, kind: 'info', message });
      } else {
        textLog.info(message);
      }
    },
    log(message: string) {
      if (jsonl) {
        writeJsonlEvent({ v: 1, kind: 'log', message });
      } else {
        textLog.log(message);
      }
    },
    secondary(message: string) {
      if (!jsonl) {
        textLog.secondary(message);
      }
    },
    indentedMuted(message: string) {
      if (!jsonl) {
        textLog.muted(message);
      }
    },
    blankLine() {
      if (!jsonl) {
        textLog.blankLine();
      }
    },
    event(event: EventV1) {
      if (jsonl) {
        writeJsonlEvent(event);
      }
    },
  };
}
