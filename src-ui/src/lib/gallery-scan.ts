import type { GalleryScanEvent } from '@cli-protocol';

/** Re-export of the CLI gallery scan payload for UI state. */
export type GalleryScanResult = GalleryScanEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isGalleryScanFile(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const kind = value.mediaKind;
  return (
    typeof value.path === 'string' &&
    typeof value.basename === 'string' &&
    (kind === 'video' || kind === 'photo' || kind === 'unknown') &&
    (value.unixSeconds === null || typeof value.unixSeconds === 'number')
  );
}

function isGalleryScanDay(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.dayKey !== 'string' || !Array.isArray(value.files)) {
    return false;
  }
  return value.files.every(isGalleryScanFile);
}

/** Validates a `gallery_scan` event from JSONL stdout. */
export function isGalleryScanEvent(value: unknown): value is GalleryScanResult {
  if (!isRecord(value) || value.v !== 1 || value.kind !== 'gallery_scan') {
    return false;
  }
  return (
    typeof value.root === 'string' &&
    typeof value.totalFiles === 'number' &&
    Array.isArray(value.days) &&
    value.days.every(isGalleryScanDay)
  );
}

const dayTitleFormatter = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  timeZone: 'UTC',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'UTC',
});

/** Human-readable section title for a UTC day key. */
export function formatGalleryDayTitle(dayKey: string): string {
  if (dayKey === 'unknown') {
    return 'Unknown date';
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  if (!match) {
    return dayKey;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return dayTitleFormatter.format(
    new Date(Date.UTC(year, month - 1, day, 12, 0, 0)),
  );
}

/** Short capture time label for a grid cell overlay. */
export function formatGalleryCaptureTime(unixSeconds: number | null): string {
  if (unixSeconds === null) {
    return '';
  }
  return timeFormatter.format(new Date(unixSeconds * 1000));
}
