import { utimesSync } from 'node:fs';
import path from 'node:path';
import { execa } from 'execa';

/** GPS coordinates optionally applied with a fixed timestamp. */
export interface GpsCoordinates {
  latitude: number;
  longitude: number;
  altitude: number | null;
}

export async function hasValidCreateDate(filePath: string): Promise<boolean> {
  const { stdout } = await execa('exiftool', ['-s3', '-CreateDate', filePath]);
  return Boolean(stdout.trim()) && !stdout.includes('0000:00:00');
}

const PHOTO_DATE_COPY_ARGS = [
  '-FileCreateDate<DateTimeDigitized',
  '-FileModifyDate<DateTimeDigitized',
  '-FileCreateDate<CreateDate',
  '-FileModifyDate<CreateDate',
  '-FileCreateDate<DateTimeOriginal',
  '-FileModifyDate<DateTimeOriginal',
];

function formatUnixTimestampAsExifToolDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}

function applyOsFileTimes(filePath: string, timestamp: number): void {
  const fsDate = new Date(timestamp * 1000);
  try {
    utimesSync(filePath, fsDate, fsDate);
  } catch {
    // Non-fatal: metadata writes already succeeded.
  }
}

/**
 * Fix dates on a photo file in-place using photo-specific metadata tags.
 */
export async function fixDatesOnPhoto(filePath: string): Promise<void> {
  await execa('exiftool', [
    '-quiet',
    '-overwrite_original',
    '-P',
    ...PHOTO_DATE_COPY_ARGS,
    filePath,
  ]);
  await syncFilesystemDatesFromMetadata(filePath, 'photo');
}

export async function hasValidPhotoDate(filePath: string): Promise<boolean> {
  const { stdout } = await execa('exiftool', [
    '-s3',
    '-DateTimeOriginal',
    filePath,
  ]);
  return Boolean(stdout.trim()) && !stdout.includes('0000:00:00');
}

export async function fixDatesFromTimestamp(
  filePath: string,
  timestamp: number,
  gps?: GpsCoordinates,
): Promise<void> {
  const exifDate = formatUnixTimestampAsExifToolDate(timestamp);

  const args: string[] = [
    '-overwrite_original',
    '-api',
    'QuickTimeUTC',
    `-AllDates=${exifDate}`,
    `-DateTimeOriginal=${exifDate}`,
    `-CreateDate=${exifDate}`,
    `-ModifyDate=${exifDate}`,
    `-ContentCreateDate=${exifDate}`,
    `-CreationDate=${exifDate}`,
    `-MediaCreateDate=${exifDate}`,
    `-MediaModifyDate=${exifDate}`,
    `-TrackCreateDate=${exifDate}`,
    `-TrackModifyDate=${exifDate}`,
    `-FileCreateDate=${exifDate}`,
    `-FileModifyDate=${exifDate}`,
  ];

  if (gps) {
    const absLat = Math.abs(gps.latitude);
    const absLon = Math.abs(gps.longitude);
    const latRef = gps.latitude >= 0 ? 'N' : 'S';
    const lonRef = gps.longitude >= 0 ? 'E' : 'W';

    args.push(
      `-GPSLatitude=${absLat}`,
      `-GPSLatitudeRef=${latRef}`,
      `-GPSLongitude=${absLon}`,
      `-GPSLongitudeRef=${lonRef}`,
    );

    if (gps.altitude !== null) {
      const absAlt = Math.abs(gps.altitude);
      const altRef = gps.altitude >= 0 ? 0 : 1;
      args.push(`-GPSAltitude=${absAlt}`, `-GPSAltitudeRef=${altRef}`);
    }
  }

  args.push(filePath);

  await execa('exiftool', args);

  applyOsFileTimes(filePath, timestamp);
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
  'CreateDate',
  'DateTimeOriginal',
] as const;

export const FILESYSTEM_DATE_TAGS = [
  'FileCreateDate',
  'FileModifyDate',
] as const;

export function parseExifToolDateToUnixSeconds(raw: string): number | null {
  const s = raw.trim();
  if (!s.length || s.includes('0000:00:00')) {
    return null;
  }
  const isoLike = s.replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const ms = Date.parse(isoLike);
  if (Number.isNaN(ms)) {
    return null;
  }
  return Math.floor(ms / 1000);
}

async function readExifDateTagMap(
  filePath: string,
  tags: readonly string[],
): Promise<Record<string, string>> {
  if (tags.length === 0) {
    return {};
  }
  const args: string[] = ['-j', '-charset', 'utf8'];
  for (const t of tags) {
    args.push(`-${t}`);
  }
  args.push(filePath);
  const { stdout } = await execa('exiftool', args);
  const parsed: unknown = JSON.parse(stdout);
  if (!Array.isArray(parsed) || parsed.length < 1) {
    return {};
  }
  const row = parsed[0];
  if (typeof row !== 'object' || row === null) {
    return {};
  }
  const rec = row as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const t of tags) {
    const v = rec[t];
    if (typeof v === 'string' && v.trim().length > 0) {
      out[t] = v.trim();
    }
  }
  return out;
}

function resolvePreferredMetadataDate(
  tagValues: Record<string, string>,
  tags: readonly string[],
): number | null {
  for (let i = tags.length - 1; i >= 0; i -= 1) {
    const tag = tags[i];
    const raw = tagValues[tag];
    if (!raw) {
      continue;
    }
    const unixSeconds = parseExifToolDateToUnixSeconds(raw);
    if (unixSeconds !== null) {
      return unixSeconds;
    }
  }
  return null;
}

async function writeFilesystemDateTags(
  filePath: string,
  timestamp: number,
): Promise<void> {
  const exifDate = formatUnixTimestampAsExifToolDate(timestamp);
  await execa('exiftool', [
    '-overwrite_original',
    '-api',
    'QuickTimeUTC',
    `-FileCreateDate=${exifDate}`,
    `-FileModifyDate=${exifDate}`,
    filePath,
  ]);
}

export async function syncFilesystemDatesFromMetadata(
  filePath: string,
  mediaKind: 'video' | 'photo',
): Promise<boolean> {
  const sourceTags =
    mediaKind === 'video' ? VIDEO_DATE_SOURCE_TAGS : PHOTO_DATE_SOURCE_TAGS;
  const tagValues = await readExifDateTagMap(filePath, sourceTags);
  const preferredUnixSeconds = resolvePreferredMetadataDate(
    tagValues,
    sourceTags,
  );
  if (preferredUnixSeconds === null) {
    return false;
  }

  await writeFilesystemDateTags(filePath, preferredUnixSeconds);
  applyOsFileTimes(filePath, preferredUnixSeconds);
  return true;
}

/**
 * Sets filesystem modification and access times from the preferred embedded capture-date tag.
 */
export async function applyPreferredCaptureDateToOs(
  filePath: string,
  mediaKind: 'video' | 'photo',
): Promise<boolean> {
  const sourceTags =
    mediaKind === 'video' ? VIDEO_DATE_SOURCE_TAGS : PHOTO_DATE_SOURCE_TAGS;
  const tagValues = await readExifDateTagMap(filePath, sourceTags);
  const preferredUnixSeconds = resolvePreferredMetadataDate(
    tagValues,
    sourceTags,
  );
  if (preferredUnixSeconds === null) {
    return false;
  }
  applyOsFileTimes(filePath, preferredUnixSeconds);
  return true;
}

/** One embedded tag value surfaced as a candidate for `fix-dates inspect`. */
export interface MediaDateCandidate {
  readonly id: string;
  readonly label: string;
  readonly raw: string;
  readonly unixSeconds: number | null;
}

/** Result of scanning one file for date sources (JSON on stdout for `fix-dates inspect`). */
export interface MediaDateInspectResult {
  readonly path: string;
  readonly basename: string;
  readonly mediaKind: 'video' | 'photo' | 'unknown';
  readonly hasAutomaticDateOk: boolean;
  readonly suggestedCandidateId: string | null;
  readonly candidates: MediaDateCandidate[];
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
  if (INSPECT_VIDEO_EXT.has(ext)) {
    return 'video';
  }
  if (INSPECT_IMAGE_EXT.has(ext)) {
    return 'photo';
  }
  return 'unknown';
}

function exifRows(
  tagValues: Record<string, string>,
  tags: readonly string[],
): MediaDateCandidate[] {
  const out: MediaDateCandidate[] = [];
  for (const tag of tags) {
    const raw = tagValues[tag];
    if (!raw) {
      continue;
    }
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
    if (raw && parseExifToolDateToUnixSeconds(raw) !== null) {
      return `exif:${tag}`;
    }
  }
  return null;
}

function photoExifWinnerId(tagValues: Record<string, string>): string | null {
  for (let i = PHOTO_DATE_SOURCE_TAGS.length - 1; i >= 0; i -= 1) {
    const tag = PHOTO_DATE_SOURCE_TAGS[i];
    const raw = tagValues[tag];
    if (raw && parseExifToolDateToUnixSeconds(raw) !== null) {
      return `exif:${tag}`;
    }
  }
  return null;
}

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
    ...exifRows(tagValues, exifTagListForRows),
    ...exifRows(tagValues, FILESYSTEM_DATE_TAGS),
  ];

  const hasAutomaticDateOk =
    mediaKind === 'video'
      ? await hasValidCreateDate(filePath)
      : mediaKind === 'photo'
        ? await hasValidPhotoDate(filePath)
        : (await hasValidCreateDate(filePath)) ||
          (await hasValidPhotoDate(filePath));

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
