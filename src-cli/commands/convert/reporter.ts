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

  /** Used when the input extension is not part of the convert pipeline. */
  progressOnly(done: number): void {
    this.output.event({
      v: 1,
      kind: 'progress',
      done,
      total: this.total,
    });
  }

  end(stats: {
    processed: number;
    skipped: number;
    failed: number;
  }): void {
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
