import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { createCliOutput } from '../utils/logger.js';
import { validateTools } from '../utils/validation.js';
import {
  fixDatesInPlace,
  fixDatesOnPhoto,
  hasUsablePhotoExifFileDates,
  hasValidCreateDate,
  hasValidPhotoDate,
} from '../utils/dates.js';

const optionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
});

type Options = z.infer<typeof optionsSchema>;

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
  .action(async (paths: string[], opts: Options) => {
    const options = optionsSchema.parse({
      cwd: path.resolve(opts.cwd),
      jsonl: opts.jsonl,
    });

    const output = createCliOutput(Boolean(options.jsonl));
    try {
      const logOk = (message: string) => {
        if (output.jsonl) output.log(message);
        else output.muted(message);
      };
      const logFixed = (message: string) => {
        if (output.jsonl) output.success(message);
        else output.muted(message);
      };

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
        output.error('No valid paths provided.', 'no_valid_paths');
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
        output.error('No media files found.', 'no_media_files');
        process.exit(1);
      }

      if (!output.jsonl) {
        output.blankLine();
        output.info('Source');
        output.indentedMuted(`${existingPaths.length} path(s)`);
        output.info('Destination');
        output.indentedMuted('In-place (input files updated)');
        output.info('Mode');
        output.indentedMuted(
          'Restore file dates from embedded EXIF/QuickTime tags',
        );
        output.blankLine();
        output.info('Files');
        output.indentedMuted(
          `${totalFiles} total (${videoFiles.length} video(s), ${imageFiles.length} photo(s))`,
        );
        output.blankLine();
      } else {
        output.log(
          `Fixing ${totalFiles} file(s) (${videoFiles.length} video(s), ${imageFiles.length} photo(s))`,
        );
      }

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
            logOk(`OK · ${baseName}`);
            alreadyOkCount++;
            continue;
          }

          // Priority 1: Try JSON sidecar (Google Takeout)
          // no-op

          // Priority 2: Try EXIF metadata
          try {
            await fixDatesInPlace(file);
          } catch {
            // Writing not supported for this format
          }

          // Verify if it worked
          if (await hasValidCreateDate(file)) {
            logFixed(`Fixed · ${baseName}`);
            fixedCount++;
          } else {
            output.warn(`Failed · ${baseName} · no valid source date found`);
            failedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not yet supported')) {
            output.warn(`Skipped · ${baseName} · format not writable`);
          } else {
            output.warn(`Failed · ${baseName} · ${msg}`);
          }
          failedCount++;
        }
      }

      // Process photos
      for (const file of imageFiles) {
        const baseName = path.basename(file);

        try {
          // Check if already has valid date
          if (
            (await hasValidPhotoDate(file)) &&
            (await hasUsablePhotoExifFileDates(file))
          ) {
            logOk(`OK · ${baseName}`);
            alreadyOkCount++;
            continue;
          }

          // Priority 1: Try JSON sidecar (Google Takeout)
          // no-op

          // Priority 2: Try EXIF metadata
          try {
            await fixDatesOnPhoto(file);
          } catch {
            // Writing not supported for this format
          }

          // Verify if it worked
          if (await hasUsablePhotoExifFileDates(file)) {
            logFixed(`Fixed · ${baseName}`);
            fixedCount++;
          } else {
            output.warn(`Failed · ${baseName} · no valid source date found`);
            failedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes('not yet supported')) {
            output.warn(`Skipped · ${baseName} · format not writable`);
          } else {
            output.warn(`Failed · ${baseName} · ${msg}`);
          }
          failedCount++;
        }
      }

      if (!output.jsonl) {
        output.blankLine();
        output.success(
          `Done · ${fixedCount} fixed, ${alreadyOkCount} OK, ${failedCount} failed`,
        );
        output.blankLine();
      } else {
        output.success(
          `Done · ${fixedCount} fixed, ${alreadyOkCount} OK, ${failedCount} failed`,
        );
      }
    } catch (error) {
      output.blankLine();
      output.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
