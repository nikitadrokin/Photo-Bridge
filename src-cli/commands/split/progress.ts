import { stdout } from 'node:process';
import kleur from 'kleur';
import type { CliOutput } from '../../utils/logger.js';

/** Labels the slow pre-move work shown in human-mode progress lines. */
export type SplitProgressPhase = 'hash' | 'read_dates';

const PHASE_LABELS: Record<SplitProgressPhase, string> = {
  hash: 'Hashing',
  read_dates: 'Reading dates',
};

/**
 * Streams split progress to JSONL consumers and human terminals.
 * On a TTY, updates a single in-place line; otherwise logs periodically.
 */
export class SplitProgressReporter {
  private lastLineLength = 0;

  constructor(
    private readonly output: CliOutput,
    private readonly total: number,
    private readonly options: { readonly emitEvents?: boolean } = {},
  ) {}

  /** Reports incremental progress for one file in the current phase. */
  tick(done: number, detail: string, phase: SplitProgressPhase): void {
    if (this.options.emitEvents ?? true) {
      this.output.event({
        v: 1,
        kind: 'progress',
        done,
        total: this.total,
      });
    }

    if (this.output.jsonl) {
      return;
    }

    const label = PHASE_LABELS[phase];
    const line = ` ${label} · ${done}/${this.total} · ${detail}`;

    if (stdout.isTTY) {
      const padded =
        line.length >= this.lastLineLength
          ? line
          : `${line}${' '.repeat(this.lastLineLength - line.length)}`;
      stdout.write(`\r${kleur.dim(padded)}`);
      this.lastLineLength = line.length;
      return;
    }

    if (done === 1 || done === this.total || done % 25 === 0) {
      console.log(kleur.dim(line));
    }
  }

  /** Ends an in-place progress line so following log output starts on a new row. */
  finish(): void {
    if (this.output.jsonl || !stdout.isTTY || this.lastLineLength === 0) {
      return;
    }

    stdout.write('\n');
    this.lastLineLength = 0;
  }
}
