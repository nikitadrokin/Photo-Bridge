/**
 * Versioned NDJSON events emitted by `pb` when `--jsonl` is set.
 * User-facing copy lives in the Tauri UI; payloads stay minimal (kinds, codes, counts).
 */

export type Command = 'convert' | 'copy';

/** How inputs were resolved: one directory vs explicit file list. */
export type SessionLayout = 'directory' | 'files';

/** High-level media bucket for a single input file. */
export type MediaType = 'image' | 'video' | 'legacy_video';

/** Outcome for one file row in the activity feed. */
export type FileStatus = 'done' | 'skipped' | 'failed';

/**
 * Why a file was skipped or failed (machine-oriented; UI maps to strings).
 */
export type FileErrorReason =
  | 'output_exists'
  | 'output_same_as_input'
  | 'unreadable_video'
  | 'processing_error';

export interface SessionEvent {
  readonly v: 1;
  readonly kind: 'session';
  readonly phase: 'start' | 'end';
  readonly command: Command;
  readonly layout: SessionLayout;
  /** Absolute output directory when batching to a folder; omitted for in-place files mode. */
  readonly outputDir?: string;
  /** Number of media files considered in this run (after extension filter). */
  readonly total?: number;
  readonly processed?: number;
  readonly skipped?: number;
  readonly failed?: number;
}

export interface FileEvent {
  readonly v: 1;
  readonly kind: 'file';
  readonly status: FileStatus;
  readonly media: MediaType;
  /** Normalized extension without dot, e.g. `mov`, `heic`. */
  readonly extIn: string;
  /** Target container/extension without dot, e.g. `mp4`; same as extIn when unchanged. */
  readonly extOut: string;
  readonly name?: string;
  readonly reason?: FileErrorReason;
}

export interface ProgressEvent {
  readonly v: 1;
  readonly kind: 'progress';
  readonly done: number;
  readonly total: number;
}

/** Byte-level ADB sync progress for `push-to-pixel` (one line per progress tick). */
export interface PushBytesProgressEvent {
  readonly v: 1;
  readonly kind: 'push_bytes';
  readonly file: string;
  readonly bytesTransferred: number;
  readonly completedFiles: number;
  readonly totalFiles: number;
}

/** Byte-level ADB sync progress for `pull-from-pixel` (same shape as `push_bytes`). */
export interface PullBytesProgressEvent {
  readonly v: 1;
  readonly kind: 'pull_bytes';
  readonly file: string;
  readonly bytesTransferred: number;
  readonly completedFiles: number;
  readonly totalFiles: number;
}

export interface BlockedEvent {
  readonly v: 1;
  readonly kind: 'blocked';
  readonly code: 'missing_tools' | string;
  readonly tools?: readonly string[];
}

export interface SeverityEvent {
  readonly v: 1;
  readonly kind: 'warn' | 'error';
  readonly code: string;
  readonly detail?: string;
}

export interface MessageEvent {
  readonly v: 1;
  readonly kind: 'info' | 'success' | 'log';
  readonly message: string;
}

/** Result of `pb shell --jsonl -- df -h .` for the transfer UI storage card. */
export interface ShellStorageEvent {
  readonly v: 1;
  readonly kind: 'shell_storage';
  /** Display label (e.g. `17GB`) */
  readonly availHuman: string;
  readonly exitCode: number;
}

export type EventV1 =
  | SessionEvent
  | FileEvent
  | ProgressEvent
  | PushBytesProgressEvent
  | PullBytesProgressEvent
  | BlockedEvent
  | SeverityEvent
  | MessageEvent
  | ShellStorageEvent;

/** Legacy stdout lines from `logger` before structured events. */
export interface Log {
  readonly type: 'error' | 'warn' | 'info' | 'success' | 'log';
  readonly message: string;
}

const LEGACY_TYPES = new Set<Log['type']>([
  'error',
  'warn',
  'info',
  'success',
  'log',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCliUiEventV1(parsed: unknown): parsed is EventV1 {
  if (!isRecord(parsed) || parsed.v !== 1 || typeof parsed.kind !== 'string') {
    return false;
  }
  switch (parsed.kind) {
    case 'session':
      return (
        (parsed.phase === 'start' || parsed.phase === 'end') &&
        (parsed.command === 'convert' || parsed.command === 'copy') &&
        (parsed.layout === 'directory' || parsed.layout === 'files')
      );
    case 'file':
      return (
        (parsed.status === 'done' ||
          parsed.status === 'skipped' ||
          parsed.status === 'failed') &&
        (parsed.media === 'image' ||
          parsed.media === 'video' ||
          parsed.media === 'legacy_video') &&
        typeof parsed.extIn === 'string' &&
        typeof parsed.extOut === 'string'
      );
    case 'progress':
      return (
        typeof parsed.done === 'number' && typeof parsed.total === 'number'
      );
    case 'push_bytes':
    case 'pull_bytes':
      return (
        typeof parsed.file === 'string' &&
        typeof parsed.bytesTransferred === 'number' &&
        typeof parsed.completedFiles === 'number' &&
        typeof parsed.totalFiles === 'number'
      );
    case 'blocked':
      return typeof parsed.code === 'string';
    case 'warn':
    case 'error':
      return typeof parsed.code === 'string';
    case 'info':
    case 'success':
    case 'log':
      return typeof parsed.message === 'string';
    case 'shell_storage':
      return (
        typeof parsed.availHuman === 'string' &&
        typeof parsed.raw === 'string' &&
        typeof parsed.exitCode === 'number'
      );
    default:
      return false;
  }
}

function isLegacyCliLog(parsed: unknown): parsed is Log {
  if (!isRecord(parsed)) return false;
  const t = parsed.type;
  return (
    typeof t === 'string' &&
    LEGACY_TYPES.has(t as Log['type']) &&
    typeof parsed.message === 'string'
  );
}

export type ParsedCliLine =
  | { readonly tag: 'ui'; readonly event: EventV1 }
  | { readonly tag: 'legacy'; readonly log: Log }
  | { readonly tag: 'raw'; readonly text: string };

/**
 * Normalize the legacy binary format (uses `type` instead of `kind`, no `v`)
 * into the current EventV1 shape, so stale binaries still drive the UI.
 */
function normalizeLegacyBinaryEvent(
  parsed: Record<string, unknown>,
): EventV1 | null {
  const type = parsed['type'];
  if (
    type === 'progress' &&
    typeof parsed['completedFiles'] === 'number' &&
    typeof parsed['totalFiles'] === 'number'
  ) {
    // Byte-level push progress → push_bytes
    if (
      typeof parsed['bytesTransferred'] === 'number' &&
      typeof parsed['file'] === 'string'
    ) {
      return {
        v: 1,
        kind: 'push_bytes',
        file: parsed['file'],
        bytesTransferred: parsed['bytesTransferred'],
        completedFiles: parsed['completedFiles'],
        totalFiles: parsed['totalFiles'],
      };
    }
  }
  if (
    type === 'file_complete' &&
    typeof parsed['completedFiles'] === 'number' &&
    typeof parsed['totalFiles'] === 'number'
  ) {
    // File completed → progress
    return {
      v: 1,
      kind: 'progress',
      done: parsed['completedFiles'],
      total: parsed['totalFiles'],
    };
  }
  return null;
}

export function parseLineFromCLI(line: string): ParsedCliLine {
  const trimmed = line.replace(/\r$/, '').trim();
  if (trimmed.length === 0) {
    return { tag: 'raw', text: '' };
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isCliUiEventV1(parsed)) {
      return { tag: 'ui', event: parsed };
    }
    if (isLegacyCliLog(parsed)) {
      return { tag: 'legacy', log: parsed };
    }
    if (isRecord(parsed)) {
      const normalized = normalizeLegacyBinaryEvent(parsed);
      if (normalized) {
        return { tag: 'ui', event: normalized };
      }
    }
  } catch {
    // fall through
  }
  return { tag: 'raw', text: trimmed };
}
