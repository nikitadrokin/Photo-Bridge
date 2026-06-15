import path from 'node:path';
import { promises as fs } from 'node:fs';
import { execa } from 'execa';

/**
 * @param value exiftool `-T` or `-s3` date value (e.g. `2019:03:20 10:00:00`)
 * @returns whether the value is non-empty, parseable, and not an all-zeros date
 */
function isUsableExifDateValue(value: string | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  const t = value.trim();
  if (t.length === 0) return false;
  if (t.includes('0000:00:00')) return false;
  return /^\d{4}:\d{2}:\d{2}/.test(t);
}

/**
 * Date tag priority chain (later tags override earlier ones):
 * MediaCreateDate -> CreateDate -> DateTimeOriginal -> ContentCreateDate -> CreationDate
 */
const DATE_COPY_ARGS = [
  // Base fallback
  '-AllDates<MediaCreateDate',
  '-Track*Date<MediaCreateDate',
  '-Media*Date<MediaCreateDate',
  '-FileCreateDate<MediaCreateDate',
  '-FileModifyDate<MediaCreateDate',
  // CreateDate (QuickTime group - Google Photos exports)
  '-AllDates<CreateDate',
  '-Track*Date<CreateDate',
  '-Media*Date<CreateDate',
  '-FileCreateDate<CreateDate',
  '-FileModifyDate<CreateDate',
  // DateTimeOriginal (common in older formats)
  '-AllDates<DateTimeOriginal',
  '-Track*Date<DateTimeOriginal',
  '-Media*Date<DateTimeOriginal',
  '-FileCreateDate<DateTimeOriginal',
  '-FileModifyDate<DateTimeOriginal',
  // ContentCreateDate (Google Photos exports, ItemList group)
  '-AllDates<ContentCreateDate',
  '-Track*Date<ContentCreateDate',
  '-Media*Date<ContentCreateDate',
  '-FileCreateDate<ContentCreateDate',
  '-FileModifyDate<ContentCreateDate',
  // CreationDate (highest priority - iPhone native, Keys group)
  '-AllDates<CreationDate',
  '-Track*Date<CreationDate',
  '-Media*Date<CreationDate',
  '-FileCreateDate<CreationDate',
  '-FileModifyDate<CreationDate',
];

/**
 * Check if a file has a valid CreateDate
 */
export async function hasValidCreateDate(filePath: string): Promise<boolean> {
  const { stdout } = await execa('exiftool', ['-s3', '-CreateDate', filePath]);
  return isUsableExifDateValue(stdout);
}

/**
 * Copy date metadata from source file to target file using priority chain.
 * If source and target are the same, reads and writes to the same file.
 */
export async function copyDatesFromSource(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  await execa('exiftool', [
    '-quiet',
    '-overwrite_original',
    '-api',
    'QuickTimeUTC',
    '-TagsFromFile',
    sourcePath,
    ...DATE_COPY_ARGS,
    targetPath,
  ]);
}

/**
 * Preserve only filesystem create/modify dates on a copied file.
 * This does not rewrite embedded media metadata, so Copy mode can remain a
 * byte-for-byte media copy while avoiding "created today" output files.
 */
export async function preserveFilesystemDatesFromSource(
  sourcePath: string,
  targetPath: string,
): Promise<void> {
  try {
    await execa('exiftool', [
      '-quiet',
      '-overwrite_original',
      '-TagsFromFile',
      sourcePath,
      '-FileCreateDate<FileCreateDate',
      '-FileModifyDate<FileModifyDate',
      targetPath,
    ]);
  } catch {
    // Fall back to mtime/atime when FileCreateDate cannot be written.
    const stat = await fs.stat(sourcePath);
    await fs.utimes(targetPath, stat.atime, stat.mtime);
  }
}

/**
 * Fix dates on a file in-place by reading from its own metadata.
 */
export async function fixDatesInPlace(filePath: string): Promise<void> {
  await execa('exiftool', [
    '-overwrite_original',
    '-api',
    'QuickTimeUTC',
    ...DATE_COPY_ARGS,
    filePath,
  ]);
}

/**
 * `DateTimeOriginal` = capture time (EXIF) — the usual “when taken” / Finder/Spotlight time for images.
 * `CreateDate` / `DateTimeDigitized` = fallbacks for recovery when DTO is missing, without overwriting
 * DTO/Create when writing (we only set Exif `File*Date` in metadata).
 * Order: prefer capture time, then other embedded dates.
 */
const PHOTO_BEST_EXIF_FILE_DATE_TAG_ORDER = [
  'DateTimeOriginal',
  'CreateDate',
  'DateCreated',
  'DateTimeDigitized',
  'ModifyDate',
] as const;

/**
 * One exiftool read. Returns the best (first valid) exiftool datetime string for restoring
 * exiftool `FileCreateDate` / `FileModifyDate` (embedded file-date tags), in priority order.
 *
 * @param filePath path to a photo
 * @returns a single line suitable for `File*=` in exiftool, or `null` if no usable tag
 */
export async function readBestExifStringForPhotoFileDates(
  filePath: string,
): Promise<string | null> {
  const { stdout } = await execa('exiftool', [
    '-T',
    ...PHOTO_BEST_EXIF_FILE_DATE_TAG_ORDER.map((tag) => `-${tag}`),
    filePath,
  ]);
  const parts = stdout
    .replace(/\r?\n$/, '')
    .split('\t')
    .map((s) => s.trim());
  for (let i = 0; i < PHOTO_BEST_EXIF_FILE_DATE_TAG_ORDER.length; i++) {
    const v = parts[i] ?? '';
    if (isUsableExifDateValue(v)) return v;
  }
  return null;
}

/**
 * Fix dates on a photo: copy the best available embedded date into exiftool.
 * `FileCreateDate` / `FileModifyDate` only. Does not alter `DateTimeOriginal`, `CreateDate`,
 * or `DateTimeDigitized`.
 */
export async function fixDatesOnPhoto(filePath: string): Promise<void> {
  const best = await readBestExifStringForPhotoFileDates(filePath);
  if (best === null) return;
  await execa('exiftool', [
    '-quiet',
    '-overwrite_original',
    '-P',
    `-FileCreateDate=${best}`,
    `-FileModifyDate=${best}`,
    filePath,
  ]);
}

/**
 * `DateTimeOriginal` present and usable (batch “no work” when you care about EXIF capture time only).
 */
export async function hasValidPhotoDate(filePath: string): Promise<boolean> {
  const { stdout } = await execa('exiftool', [
    '-s3',
    '-DateTimeOriginal',
    filePath,
  ]);
  return isUsableExifDateValue(stdout);
}

/**
 * exiftool `FileCreateDate` and `FileModifyDate` in metadata — what this command
 * overwrites; matches the recovery success path.
 */
export async function hasUsablePhotoExifFileDates(
  filePath: string,
): Promise<boolean> {
  const { stdout } = await execa('exiftool', [
    '-T',
    '-FileCreateDate',
    '-FileModifyDate',
    filePath,
  ]);
  const parts = stdout
    .replace(/\r?\n$/, '')
    .split('\t')
    .map((s) => s.trim());
  if (parts.length < 2) return false;
  return (
    isUsableExifDateValue(parts[0] ?? '') &&
    isUsableExifDateValue(parts[1] ?? '')
  );
}

/**
 * Whether exiftool `FileCreateDate` / `FileModifyDate` already match the best
 * embedded photo date (including XMP `DateCreated` / Photos "Content Created").
 */
export async function photoEmbeddedFileDatesAlreadyOk(
  filePath: string,
): Promise<boolean> {
  const best = await readBestExifStringForPhotoFileDates(filePath);
  if (best === null) return false;

  const bestUnix = parseExifToolDateToUnixSeconds(best);

  if (bestUnix === null) return false;

  const { stdout } = await execa('exiftool', [
    '-T',
    '-FileCreateDate',
    '-FileModifyDate',
    filePath,
  ]);
  const parts = stdout
    .replace(/\r?\n$/, '')
    .split('\t')
    .map((s) => s.trim());
  if (parts.length < 2) return false;

  const fileCreateUnix = parseExifToolDateToUnixSeconds(parts[0] ?? '');
  const fileModifyUnix = parseExifToolDateToUnixSeconds(parts[1] ?? '');
  if (fileCreateUnix === null || fileModifyUnix === null) return false;

  return fileCreateUnix === bestUnix && fileModifyUnix === bestUnix;
}

/**
 * Parses an exiftool date string (e.g. `2019:03:20 10:00:00`) to Unix seconds.
 */
export function parseExifToolDateToUnixSeconds(raw: string): number | null {
  const s = raw.trim();
  if (!s.length || s.includes('0000:00:00')) return null;
  const isoLike = s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const ms = Date.parse(isoLike);
  if (Number.isNaN(ms)) return null;
  return Math.floor(ms / 1000);
}

export const VIDEO_DATE_SOURCE_TAGS = [
  'MediaCreateDate',
  'CreateDate',
  'DateTimeOriginal',
  'ContentCreateDate',
  'CreationDate',
] as const;

export const PHOTO_DATE_SOURCE_TAGS = [
  'DateTimeDigitized',
  'ModifyDate',
  'CreateDate',
  'DateCreated',
  'DateTimeOriginal',
] as const;

export const FILESYSTEM_DATE_TAGS = [
  'FileCreateDate',
  'FileModifyDate',
] as const;

/** One embedded tag value surfaced as a candidate for `fix-dates inspect`. */
export interface MediaDateCandidate {
  readonly id: string;
  readonly label: string;
  readonly raw: string;
  readonly unixSeconds: number | null;
}

/** Full inspection result written to stdout by `fix-dates inspect`. */
export interface MediaDateInspectResult {
  readonly path: string;
  readonly basename: string;
  readonly mediaKind: 'video' | 'photo' | 'unknown';
  readonly hasAutomaticDateOk: boolean;
  readonly suggestedCandidateId: string | null;
  readonly candidates: readonly MediaDateCandidate[];
}

const INSPECT_VIDEO_EXT = new Set(['mov', 'mp4', 'm4v', 'mpg', 'mpeg']);
const INSPECT_IMAGE_EXT = new Set([
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'dng',
  'webp',
]);

function classifyMediaKind(filePath: string): 'video' | 'photo' | 'unknown' {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  if (INSPECT_VIDEO_EXT.has(ext)) return 'video';
  if (INSPECT_IMAGE_EXT.has(ext)) return 'photo';
  return 'unknown';
}

async function readExifDateTagMap(
  filePath: string,
  tags: readonly string[],
): Promise<Record<string, string>> {
  if (tags.length === 0) return {};
  const args = ['-j', '-charset', 'utf8'];
  for (const t of tags) args.push(`-${t}`);
  args.push(filePath);
  const { stdout } = await execa('exiftool', args);
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length < 1) return {};
  const row = parsed[0];
  if (typeof row !== 'object' || row === null) return {};
  const rec = row as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const t of tags) {
    const v = rec[t];
    if (typeof v === 'string' && v.trim().length > 0) out[t] = v.trim();
  }
  return out;
}

function exifCandidateRows(
  tagValues: Record<string, string>,
  tags: readonly string[],
): MediaDateCandidate[] {
  const out: MediaDateCandidate[] = [];
  for (const tag of tags) {
    const raw = tagValues[tag];
    if (!raw) continue;
    out.push({
      id: `exif:${tag}`,
      label: tag,
      raw,
      unixSeconds: parseExifToolDateToUnixSeconds(raw),
    });
  }
  return out;
}

function videoExifWinnerId(tagValues: Record<string, string>): string | null {
  for (let i = VIDEO_DATE_SOURCE_TAGS.length - 1; i >= 0; i -= 1) {
    const tag = VIDEO_DATE_SOURCE_TAGS[i];
    const raw = tagValues[tag];
    if (raw && parseExifToolDateToUnixSeconds(raw) !== null)
      return `exif:${tag}`;
  }
  return null;
}

function photoExifWinnerId(tagValues: Record<string, string>): string | null {
  for (let i = PHOTO_DATE_SOURCE_TAGS.length - 1; i >= 0; i -= 1) {
    const tag = PHOTO_DATE_SOURCE_TAGS[i];
    const raw = tagValues[tag];
    if (raw && parseExifToolDateToUnixSeconds(raw) !== null)
      return `exif:${tag}`;
  }
  return null;
}

/** Inspect a single media file and return all available date candidates. */
export async function inspectMediaDates(
  filePath: string,
): Promise<MediaDateInspectResult> {
  const basename = path.basename(filePath);
  const mediaKind = classifyMediaKind(filePath);

  const uniqueVideoPhotoTags = [
    ...new Set([...VIDEO_DATE_SOURCE_TAGS, ...PHOTO_DATE_SOURCE_TAGS]),
  ];

  const tagsForKind =
    mediaKind === 'video'
      ? [...VIDEO_DATE_SOURCE_TAGS, ...FILESYSTEM_DATE_TAGS]
      : mediaKind === 'photo'
      ? [...PHOTO_DATE_SOURCE_TAGS, ...FILESYSTEM_DATE_TAGS]
      : [...uniqueVideoPhotoTags, ...FILESYSTEM_DATE_TAGS];

  const tagValues = await readExifDateTagMap(filePath, tagsForKind);

  const exifTagListForRows =
    mediaKind === 'video'
      ? VIDEO_DATE_SOURCE_TAGS
      : mediaKind === 'photo'
      ? PHOTO_DATE_SOURCE_TAGS
      : uniqueVideoPhotoTags;

  const candidates: MediaDateCandidate[] = [
    ...exifCandidateRows(tagValues, exifTagListForRows),
    ...exifCandidateRows(tagValues, FILESYSTEM_DATE_TAGS),
  ];

  const hasAutomaticDateOk =
    mediaKind === 'video'
      ? await hasValidCreateDate(filePath)
      : mediaKind === 'photo'
      ? await photoEmbeddedFileDatesAlreadyOk(filePath)
      : (await hasValidCreateDate(filePath)) ||
        (await photoEmbeddedFileDatesAlreadyOk(filePath));

  const suggestedCandidateId =
    mediaKind === 'video'
      ? videoExifWinnerId(tagValues)
      : mediaKind === 'photo'
      ? photoExifWinnerId(tagValues)
      : videoExifWinnerId(tagValues) ?? photoExifWinnerId(tagValues);

  return {
    path: filePath,
    basename,
    mediaKind,
    hasAutomaticDateOk,
    suggestedCandidateId,
    candidates,
  };
}

/**
 * Lightweight best-effort capture instant lookup for bulk organization commands.
 * Unlike inspectMediaDates, this does not validate whether automatic repair is needed,
 * so it keeps bulk scans to one exiftool read per file.
 */
export async function readMediaCaptureUnixSeconds(
  filePath: string,
): Promise<number | null> {
  const mediaKind = classifyMediaKind(filePath);
  const uniqueVideoPhotoTags = [
    ...new Set([...VIDEO_DATE_SOURCE_TAGS, ...PHOTO_DATE_SOURCE_TAGS]),
  ];

  const tagsForKind =
    mediaKind === 'video'
      ? [...VIDEO_DATE_SOURCE_TAGS, ...FILESYSTEM_DATE_TAGS]
      : mediaKind === 'photo'
      ? [...PHOTO_DATE_SOURCE_TAGS, ...FILESYSTEM_DATE_TAGS]
      : [...uniqueVideoPhotoTags, ...FILESYSTEM_DATE_TAGS];

  const tagValues = await readExifDateTagMap(filePath, tagsForKind);
  const winnerId =
    mediaKind === 'video'
      ? videoExifWinnerId(tagValues)
      : mediaKind === 'photo'
      ? photoExifWinnerId(tagValues)
      : videoExifWinnerId(tagValues) ?? photoExifWinnerId(tagValues);

  if (winnerId) {
    const tag = winnerId.replace(/^exif:/, '');
    const unixSeconds = parseExifToolDateToUnixSeconds(tagValues[tag] ?? '');
    if (unixSeconds !== null) return unixSeconds;
  }

  for (const tag of tagsForKind) {
    const unixSeconds = parseExifToolDateToUnixSeconds(tagValues[tag] ?? '');
    if (unixSeconds !== null) return unixSeconds;
  }

  return null;
}

/** Best-effort capture instant from an inspect result (suggested tag, then any dated tag). */
export function pickInspectUnixSeconds(
  inspected: MediaDateInspectResult,
): number | null {
  const suggested = inspected.candidates.find(
    (candidate) => candidate.id === inspected.suggestedCandidateId,
  );
  const fallback = inspected.candidates.find(
    (candidate) => candidate.unixSeconds !== null,
  );
  const unixSeconds = suggested?.unixSeconds ?? fallback?.unixSeconds;
  return unixSeconds ?? null;
}

/**
 * Fix dates on a file using a specific Unix timestamp (from JSON sidecar).
 * Writes the timestamp to all relevant date tags.
 */
export async function fixDatesFromTimestamp(
  filePath: string,
  timestamp: number,
): Promise<void> {
  // Convert Unix seconds to exiftool datetime format: "YYYY:MM:DD HH:MM:SS"
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  const exifDate = `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;

  await execa('exiftool', [
    '-overwrite_original',
    '-api',
    'QuickTimeUTC',
    `-AllDates=${exifDate}`,
    `-DateTimeOriginal=${exifDate}`,
    `-CreateDate=${exifDate}`,
    `-DateCreated=${exifDate}`,
    `-ModifyDate=${exifDate}`,
    `-FileCreateDate=${exifDate}`,
    `-FileModifyDate=${exifDate}`,
    filePath,
  ]);
}
