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

export type EventV1 =
  | SessionEvent
  | FileEvent
  | ProgressEvent
  | BlockedEvent
  | SeverityEvent;

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
    case 'blocked':
      return typeof parsed.code === 'string';
    case 'warn':
    case 'error':
      return typeof parsed.code === 'string';
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
 * Parse one NDJSON line from sidecar stdout.
 */
export function parseCliUiLine(line: string): ParsedCliLine {
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
  } catch {
    // fall through
  }
  return { tag: 'raw', text: trimmed };
}
