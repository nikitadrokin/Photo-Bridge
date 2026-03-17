import { execa } from 'execa';

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
  return !!stdout.trim() && !stdout.includes('0000:00:00');
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
 * Photo date tag priority chain (later tags override earlier ones):
 * DateTimeDigitized -> CreateDate -> DateTimeOriginal
 *
 * Photos typically have different metadata tags than videos.
 * DateTimeOriginal is the standard for when the photo was taken.
 */
const PHOTO_DATE_COPY_ARGS = [
  // DateTimeDigitized (fallback - when the image was digitized)
  '-FileCreateDate<DateTimeDigitized',
  '-FileModifyDate<DateTimeDigitized',
  // CreateDate (EXIF - when the image file was created)
  '-FileCreateDate<CreateDate',
  '-FileModifyDate<CreateDate',
  // DateTimeOriginal (highest priority - when the photo was actually taken)
  '-FileCreateDate<DateTimeOriginal',
  '-FileModifyDate<DateTimeOriginal',
];

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
}

/**
 * Check if a photo has a valid DateTimeOriginal
 */
export async function hasValidPhotoDate(filePath: string): Promise<boolean> {
  const { stdout } = await execa('exiftool', [
    '-s3',
    '-DateTimeOriginal',
    filePath,
  ]);
  return !!stdout.trim() && !stdout.includes('0000:00:00');
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
