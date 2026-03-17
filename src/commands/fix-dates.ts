import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { validateTools } from '../utils/validation.js';
import {
  fixDatesInPlace,
  fixDatesOnPhoto,
  fixDatesFromTimestamp,
  hasValidCreateDate,
  hasValidPhotoDate,
} from '../utils/dates.js';
import { findJsonSidecar, readPhotoTakenTime } from '../utils/json-sidecar.js';

const optionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
});

const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v', 'mpg', 'mpeg'];
const IMAGE_EXTENSIONS = ['heic', 'heif', 'jpg', 'jpeg', 'png', 'gif', 'dng'];

/**
 * Recursively collect all media files from a directory
 */
async function collectMediaFilesRecursive(
  dirPath: string,
  videoFiles: string[],
  imageFiles: string[],
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      // Recurse into subdirectory
      await collectMediaFilesRecursive(fullPath, videoFiles, imageFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (VIDEO_EXTENSIONS.includes(ext)) {
        videoFiles.push(fullPath);
      } else if (IMAGE_EXTENSIONS.includes(ext)) {
        imageFiles.push(fullPath);
      }
    }
  }
}

export const fixDates = new Command()
  .name('fix-dates')
  .description('recover/fix creation dates on media files (photos and videos)')
  .argument('[paths...]', 'directories or files to fix', ['.'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts) => {
    try {
      const options = optionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        jsonl: opts.jsonl,
      });

      if (options.jsonl) {
        logger.setMode('json');
      }

      // resolve provided relative paths into absolute paths
      const resolvedPaths = paths.map((p) => path.resolve(options.cwd, p));

      // try "fs.stat". if it fails, the path doesn't exist
      // this is useful to filter nonexistent paths or options without crashing the script
      const pathStats = await Promise.all(
        resolvedPaths.map(async (p) => {
          try {
            const stat = await fs.stat(p);
            return { path: p, stat, exists: true };
          } catch {
            return { path: p, stat: null, exists: false };
          }
        }),
      );

      // filter out nonexistent paths
      const existingPaths = pathStats.filter((p) => p.exists);
      if (existingPaths.length === 0) {
        logger.error('No valid paths provided.');
        process.exit(1);
      }

      const files = existingPaths.filter((p) => p.stat?.isFile());
      const directories = existingPaths.filter((p) => p.stat?.isDirectory());

      // Collect all media files
      let videoFiles: string[] = [];
      let imageFiles: string[] = [];

      // Recursively collect media files from directories
      for (const dir of directories) {
        await collectMediaFilesRecursive(dir.path, videoFiles, imageFiles);
      }

      // collect media files if files were passed instead of directories
      for (const file of files) {
        const ext = path.extname(file.path).toLowerCase().slice(1);
        if (VIDEO_EXTENSIONS.includes(ext)) {
          videoFiles.push(file.path);
        } else if (IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(file.path);
        }
      }

      const totalFiles = videoFiles.length + imageFiles.length;
      if (totalFiles === 0) {
        logger.error('No media files found.');
        process.exit(1);
      }

      logger.break();
      logger.log('=========================================================');
      logger.info(
        `Fixing dates on ${videoFiles.length} video(s) and ${imageFiles.length} photo(s)`,
      );
      logger.log('=========================================================');
      logger.break();

      await validateTools();

      let fixedCount = 0;
      let alreadyOkCount = 0;
      let failedCount = 0;

      // Process videos
      for (const file of videoFiles) {
        const baseName = path.basename(file);

        try {
          // Check if already has valid date
          if (await hasValidCreateDate(file)) {
            logger.log(`${baseName}`);
            alreadyOkCount++;
            continue;
          }

          // Priority 1: Try JSON sidecar (Google Takeout)
          const jsonPath = await findJsonSidecar(file);
          if (jsonPath) {
            const timestamp = await readPhotoTakenTime(jsonPath);
            if (timestamp) {
              try {
                await fixDatesFromTimestamp(file, timestamp);
                if (await hasValidCreateDate(file)) {
                  logger.success(`Fixed (from JSON): ${baseName}`);
                  fixedCount++;
                  continue;
                }
              } catch {
                // Writing not supported for this format, try next method
              }
            }
          }

          // Priority 2: Try EXIF metadata
          try {
            await fixDatesInPlace(file);
          } catch {
            // Writing not supported for this format
          }

          // Verify if it worked
          if (await hasValidCreateDate(file)) {
            logger.success(`Fixed: ${baseName}`);
            fixedCount++;
          } else {
            logger.warn(
              `Could not recover date: ${baseName} - no valid source date found`,
            );
            failedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not yet supported')) {
            logger.warn(`Skipped (format not writable): ${baseName}`);
          } else {
            logger.warn(`Error processing: ${baseName} - ${msg}`);
          }
          failedCount++;
        }
      }

      // Process photos
      for (const file of imageFiles) {
        const baseName = path.basename(file);

        try {
          // Check if already has valid date
          if (await hasValidPhotoDate(file)) {
            logger.log(`${baseName}`);
            alreadyOkCount++;
            continue;
          }

          // Priority 1: Try JSON sidecar (Google Takeout)
          const jsonPath = await findJsonSidecar(file);
          if (jsonPath) {
            const timestamp = await readPhotoTakenTime(jsonPath);
            if (timestamp) {
              try {
                await fixDatesFromTimestamp(file, timestamp);
                if (await hasValidPhotoDate(file)) {
                  logger.success(`Fixed (from JSON): ${baseName}`);
                  fixedCount++;
                  continue;
                }
              } catch {
                // Writing not supported for this format, try next method
              }
            }
          }

          // Priority 2: Try EXIF metadata
          try {
            await fixDatesOnPhoto(file);
          } catch {
            // Writing not supported for this format
          }

          // Verify if it worked
          if (await hasValidPhotoDate(file)) {
            logger.success(`Fixed: ${baseName}`);
            fixedCount++;
          } else {
            logger.warn(
              `Could not recover date: ${baseName} - no valid source date found`,
            );
            failedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not yet supported')) {
            logger.warn(`Skipped (format not writable): ${baseName}`);
          } else {
            logger.warn(`Error processing: ${baseName} - ${msg}`);
          }
          failedCount++;
        }
      }

      logger.break();
      logger.log('=========================================================');
      logger.success(
        `DONE. Fixed: ${fixedCount}, Already OK: ${alreadyOkCount}, Failed: ${failedCount}`,
      );
      logger.log('=========================================================');
      logger.break();
    } catch (error) {
      logger.break();
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
