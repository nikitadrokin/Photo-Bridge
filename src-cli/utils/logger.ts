import kleur from 'kleur';
import type { EventV1 } from '../../cli-ui-protocol.js';

let mode: 'text' | 'json' = 'text';

export const logger = {
  setMode(newMode: 'text' | 'json') {
    mode = newMode;
  },
  getMode(): 'text' | 'json' {
    return mode;
  },
  /**
   * Emit one structured UI event (NDJSON). No-op in text mode.
   */
  emitJSON(event: EventV1) {
    if (mode === 'json') {
      console.log(JSON.stringify(event));
    }
  },
  error(...args: unknown[]) {
    if (mode === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'error',
        code: 'log_error',
        detail: args.join(' '),
      });
    } else {
      console.log(kleur.red(args.join(' ')));
    }
  },
  warn(...args: unknown[]) {
    if (mode === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'warn',
        code: 'log_warn',
        detail: args.join(' '),
      });
    } else {
      console.log(kleur.yellow(args.join(' ')));
    }
  },
  info(...args: unknown[]) {
    if (mode === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'info',
        message: args.join(' '),
      });
    } else {
      console.log(kleur.cyan(args.join(' ')));
    }
  },
  success(...args: unknown[]) {
    if (mode === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'success',
        message: args.join(' '),
      });
    } else {
      console.log(kleur.green(args.join(' ')));
    }
  },
  log(...args: unknown[]) {
    if (mode === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'log',
        message: args.join(' '),
      });
    } else {
      console.log(args.join(' '));
    }
  },
  break() {
    if (mode === 'text') {
      console.log('');
    }
  },
};
