import { promises as fs } from 'node:fs';
import path from 'node:path';

export const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v', 'mpg', 'mpeg'] as const;
export const IMAGE_EXTENSIONS = [
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'dng',
] as const;

/** Lowercase extensions treated as video for batch collection. */
export const VIDEO_EXT_SET = new Set<string>(VIDEO_EXTENSIONS);
/** Lowercase extensions treated as images for batch collection. */
export const IMAGE_EXT_SET = new Set<string>(IMAGE_EXTENSIONS);

/**
 * Recursively collect all media files from a directory into the given arrays.
 */
export async function collectMediaFilesRecursive(
  dirPath: string,
  videoFiles: string[],
  imageFiles: string[],
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await collectMediaFilesRecursive(fullPath, videoFiles, imageFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (VIDEO_EXT_SET.has(ext)) {
        videoFiles.push(fullPath);
      } else if (IMAGE_EXT_SET.has(ext)) {
        imageFiles.push(fullPath);
      }
    }
  }
}
