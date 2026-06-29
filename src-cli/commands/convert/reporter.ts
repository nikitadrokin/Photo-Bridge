import type { CliOutput } from '../../utils/logger.js';
import type {
  FileErrorReason,
  FileStatus,
  MediaType,
  SessionLayout,
} from '../../../types/protocol.js';

/**
 * Emits `session` / `file` / `progress` rows for JSONL runs.
 * Uses {@link CliOutput.event}, so human mode stays quiet on stdout.
 */
export class ConvertRunReporter {
  constructor(
    private readonly output: CliOutput,
    private readonly layout: SessionLayout,
    private readonly outDir: string | null,
    private readonly total: number,
  ) {}

  start(): void {
    this.output.event({
      v: 1,
      kind: 'session',
      phase: 'start',
      command: 'convert',
      layout: this.layout,
      outputDir: this.outDir ?? undefined,
      total: this.total,
    });
  }

  fileProgress(
    row: {
      status: FileStatus;
      media: MediaType;
      extIn: string;
      extOut: string;
      name?: string;
      reason?: FileErrorReason;
    },
    done: number,
  ): void {
    this.output.event({
      v: 1,
      kind: 'file',
      ...row,
    });
    this.output.event({
      v: 1,
      kind: 'progress',
      done,
      total: this.total,
    });
  }

  /**
   * Announces the file about to be worked on. Human mode only — JSONL already
   * carries `file`/`progress` rows, so this keeps the silent CLI feeling alive
   * without polluting the machine-readable stream.
   */
  fileStart(name: string, done: number): void {
    if (this.output.jsonl) return;
    this.output.log(`[${done}/${this.total}] ${name}`);
  }

  /**
   * Surfaces a per-file failure to the human reader. JSONL already emits the
   * `failed` file row, so this is human mode only.
   */
  fileFailed(name: string, message: string): void {
    if (this.output.jsonl) return;
    this.output.warn(`Failed · ${name} · ${message}`);
  }

  /** Used when the input extension is not part of the convert pipeline. */
  progressOnly(done: number): void {
    this.output.event({
      v: 1,
      kind: 'progress',
      done,
      total: this.total,
    });
  }

  warn(code: string, detail?: string): void {
    this.output.warn(detail ?? code, code);
  }

  end(stats: { processed: number; skipped: number; failed: number }): void {
    this.output.event({
      v: 1,
      kind: 'session',
      phase: 'end',
      command: 'convert',
      layout: this.layout,
      outputDir: this.outDir ?? undefined,
      total: this.total,
      processed: stats.processed,
      skipped: stats.skipped,
      failed: stats.failed,
    });
  }
}
