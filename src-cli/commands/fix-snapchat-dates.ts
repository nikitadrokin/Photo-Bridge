import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { logger } from '../utils/logger.js';
import { validateTools } from '../utils/validation.js';
import { fixDatesFromTimestamp, hasValidPhotoDate } from '../utils/dates.js';

const optionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
  force: z.boolean().optional(),
});

type Options = z.infer<typeof optionsSchema>;

const IMAGE_EXTENSIONS = ['heic', 'heif', 'jpg', 'jpeg', 'png', 'gif', 'dng'];

/**
 * Match YYYY-MM-DD at the start of a filename.
 * e.g. "2021-12-21_D708E944-...-main.jpg" → Date object at midnight UTC
 */
function parseDateFromFilename(filename: string): Date | null {
  const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));

  if (isNaN(date.getTime())) return null;
  if (date.getFullYear() < 2000 || date.getFullYear() > new Date().getFullYear()) return null;

  return date;
}

async function collectImageFilesRecursive(
  dirPath: string,
  imageFiles: string[],
): Promise<void> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      await collectImageFilesRecursive(fullPath, imageFiles);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (IMAGE_EXTENSIONS.includes(ext)) {
        imageFiles.push(fullPath);
      }
    }
  }
}

export const fixSnapchatDates = new Command()
  .name('fix-snapchat-dates')
  .description('set creation dates on Snapchat memory exports using the YYYY-MM-DD filename prefix')
  .argument('[paths...]', 'directories or files to fix', ['.'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option(
    '-f, --force',
    'overwrite dates even if a valid DateTimeOriginal already exists',
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts: Options) => {
    try {
      const options = optionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        jsonl: opts.jsonl,
        force: opts.force,
      });

      if (options.jsonl) {
        logger.setMode('json');
      }

      const resolvedPaths = paths.map((p) => path.resolve(options.cwd, p));

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

      const existingPaths = pathStats.filter((p) => p.exists);
      if (existingPaths.length === 0) {
        logger.error('No valid paths provided.');
        process.exit(1);
      }

      const files = existingPaths.filter((p) => p.stat?.isFile());
      const directories = existingPaths.filter((p) => p.stat?.isDirectory());

      let imageFiles: string[] = [];

      for (const dir of directories) {
        await collectImageFilesRecursive(dir.path, imageFiles);
      }

      for (const file of files) {
        const ext = path.extname(file.path).toLowerCase().slice(1);
        if (IMAGE_EXTENSIONS.includes(ext)) {
          imageFiles.push(file.path);
        }
      }

      if (imageFiles.length === 0) {
        logger.error('No image files found.');
        process.exit(1);
      }

      logger.break();
      logger.log('=========================================================');
      logger.info(`Processing ${imageFiles.length} Snapchat photo(s)`);
      logger.log('=========================================================');
      logger.break();

      await validateTools(['exiftool']);

      let fixedCount = 0;
      let alreadyOkCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const file of imageFiles) {
        const baseName = path.basename(file);

        try {
          // Skip if already has a valid date (unless --force)
          if (!options.force && (await hasValidPhotoDate(file))) {
            logger.log(baseName);
            alreadyOkCount++;
            continue;
          }

          // Parse date from filename — log and skip if missing
          const date = parseDateFromFilename(baseName);
          if (!date) {
            logger.warn(`Skipped (no date in filename): ${baseName}`);
            skippedCount++;
            continue;
          }

          const timestamp = Math.floor(date.getTime() / 1000);
          await fixDatesFromTimestamp(file, timestamp);

          if (await hasValidPhotoDate(file)) {
            logger.success(`Fixed: ${baseName} → ${date.toISOString().slice(0, 10)}`);
            fixedCount++;
          } else {
            logger.warn(`Could not verify after write: ${baseName}`);
            failedCount++;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          logger.warn(`Error processing: ${baseName} - ${msg}`);
          failedCount++;
        }
      }

      logger.break();
      logger.log('=========================================================');
      logger.success(
        `DONE. Fixed: ${fixedCount}, Already OK: ${alreadyOkCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`,
      );
      logger.log('=========================================================');
      logger.break();
    } catch (error) {
      logger.break();
      logger.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });
