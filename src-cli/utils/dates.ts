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
  'DateTimeDigitized',
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
    ...PHOTO_BEST_EXIF_FILE_DATE_TAG_ORDER,
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
    `-ModifyDate=${exifDate}`,
    `-FileCreateDate=${exifDate}`,
    `-FileModifyDate=${exifDate}`,
    filePath,
  ]);
}
