import type { PushBytesProgressEvent } from '../../types/protocol.js';

/**
 * One decoded line from `adb push` / `adb pull` LinePrinter output
 * (platform-tools 34+, including 37.0.x).
 *
 * On a TTY/PTY, ticks are `\r` + `[ 42%] path` + CSI `EL` (`\x1B[K`).
 * Without a TTY, INFO ticks are buffered and only the summary is flushed.
 */
export type AdbProgressRecord =
  | {
      readonly kind: 'tick';
      /** Overall job percent, or `null` when adb prints `?`. */
      readonly overallPercent: number | null;
      readonly remotePath: string;
      /** Per-file percent when pushing multiple files. */
      readonly filePercent: number | null;
      /** Copied bytes when adb cannot trust the remote size (`N/?`). */
      readonly copiedBytes: number | null;
    }
  | {
      readonly kind: 'summary';
      readonly displayName: string;
      readonly filesTransferred: number;
      readonly filesSkipped: number;
      readonly bytesTransferred: number | null;
      readonly megabytesPerSecond: number | null;
    };

/** CSI sequences LinePrinter may emit (`\x1B[K` = erase to end of line). */
const ANSI_RE = /\u001B\[[0-9;]*[A-Za-z]/g;

/**
 * `[ 42%] /sdcard/foo.mp4`
 * `[ 42%] /sdcard/foo.mp4: 87%`  (multi-file)
 * `[   ?] /sdcard/foo.mp4: 12345/?`
 */
const TICK_RE =
  /^\[(\s*\d+%|\s*\?)\]\s+(.+?)(?:(?::\s+(\d+)%)|(?::\s+(\d+)\/\?))?\s*$/;

/**
 * `foo.mp4: 1 file pushed, 0 skipped. 35.2 MB/s (12345 bytes in 0.351s)`
 */
const SUMMARY_RE =
  /^(.*):\s+(\d+)\s+files?\s+(?:pushed|pulled),\s+(\d+)\s+skipped\.(?:\s+([\d.]+)\s+MB\/s\s+\((\d+)\s+bytes in [\d.]+s\))?\s*$/;

function stripAnsi(value: string): string {
  return value.replace(ANSI_RE, '');
}

function parsePercentToken(token: string): number | null {
  const trimmed = token.trim();
  if (trimmed === '?') return null;
  if (!trimmed.endsWith('%')) return null;
  const n = Number.parseInt(trimmed.slice(0, -1), 10);
  return Number.isFinite(n) ? n : null;
}

function parseLine(rawLine: string): AdbProgressRecord | null {
  const line = stripAnsi(rawLine).replace(/\r/g, '').trim();
  if (line.length === 0) return null;

  const tick = TICK_RE.exec(line);
  if (tick) {
    const overallToken = tick[1] ?? '';
    const remotePath = tick[2] ?? '';
    const filePercentRaw = tick[3];
    const copiedRaw = tick[4];
    if (remotePath.length === 0) return null;
    return {
      kind: 'tick',
      overallPercent: parsePercentToken(overallToken),
      remotePath,
      filePercent:
        filePercentRaw !== undefined
          ? Number.parseInt(filePercentRaw, 10)
          : null,
      copiedBytes:
        copiedRaw !== undefined ? Number.parseInt(copiedRaw, 10) : null,
    };
  }

  const summary = SUMMARY_RE.exec(line);
  if (summary) {
    const displayName = summary[1] ?? '';
    const filesTransferred = Number.parseInt(summary[2] ?? '', 10);
    const filesSkipped = Number.parseInt(summary[3] ?? '', 10);
    const rateRaw = summary[4];
    const bytesRaw = summary[5];
    if (!Number.isFinite(filesTransferred) || !Number.isFinite(filesSkipped)) {
      return null;
    }
    return {
      kind: 'summary',
      displayName,
      filesTransferred,
      filesSkipped,
      bytesTransferred:
        bytesRaw !== undefined ? Number.parseInt(bytesRaw, 10) : null,
      megabytesPerSecond:
        rateRaw !== undefined ? Number.parseFloat(rateRaw) : null,
    };
  }

  return null;
}

/**
 * Incremental decoder for adb LinePrinter output.
 * Feed raw PTY/stderr chunks; records are emitted when a line is terminated
 * by `\r` or `\n`.
 */
export class AdbProgressParser {
  #buffer = '';

  /** Decode the next stdout/stderr chunk. */
  push(chunk: string): Array<AdbProgressRecord> {
    this.#buffer += chunk;
    return this.#drain(false);
  }

  /** Parse any trailing unterminated line (end of process). */
  flush(): Array<AdbProgressRecord> {
    return this.#drain(true);
  }

  #drain(flushTail: boolean): Array<AdbProgressRecord> {
    const records: Array<AdbProgressRecord> = [];
    const parts = this.#buffer.split(/[\r\n]/);
    this.#buffer = parts.pop() ?? '';

    for (const part of parts) {
      const record = parseLine(part);
      if (record) records.push(record);
    }

    if (flushTail && this.#buffer.length > 0) {
      const record = parseLine(this.#buffer);
      this.#buffer = '';
      if (record) records.push(record);
    }

    return records;
  }
}

/**
 * Turns a parsed tick/summary into bytes for the current local file.
 * Prefers exact summary bytes, then `N/?`, then file%/overall% × size.
 */
export function bytesFromAdbProgress(
  record: AdbProgressRecord,
  fileSizeBytes: number,
): number | null {
  if (record.kind === 'summary') {
    return record.bytesTransferred;
  }
  if (record.copiedBytes !== null) {
    return record.copiedBytes;
  }
  const percent = record.filePercent ?? record.overallPercent;
  if (percent === null || fileSizeBytes <= 0) return null;
  return Math.floor((fileSizeBytes * Math.min(100, Math.max(0, percent))) / 100);
}

/** Maps a parsed record onto the existing UI `push_bytes` event. */
export function toPushBytesEvent(
  record: AdbProgressRecord,
  options: {
    readonly file: string;
    readonly fileSizeBytes: number;
    readonly completedFiles: number;
    readonly totalFiles: number;
  },
): PushBytesProgressEvent | null {
  const bytesTransferred = bytesFromAdbProgress(record, options.fileSizeBytes);
  if (bytesTransferred === null) return null;
  return {
    v: 1,
    kind: 'push_bytes',
    file: options.file,
    bytesTransferred,
    completedFiles: options.completedFiles,
    totalFiles: options.totalFiles,
    fileTotalBytes: options.fileSizeBytes,
  };
}
