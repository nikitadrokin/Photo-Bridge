import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { createCliOutput } from '../utils/logger.js';
import { validateTools } from '../utils/validation.js';
import {
  fixDatesInPlace,
  fixDatesOnPhoto,
  fixDatesFromTimestamp,
  hasUsablePhotoExifFileDates,
  hasValidCreateDate,
  hasValidPhotoDate,
  inspectMediaDates,
} from '../utils/dates.js';

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

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Copies the parent directory of `filePath` into a sibling directory suffixed
 * with `_FixedDates` (incrementing if the directory already exists), then
 * returns the path of the file inside the copy and the directory mapping.
 */
async function copyFileToSiblingDirectory(filePath: string): Promise<{
  targetPath: string;
  copiedDirectory: { sourcePath: string; destinationPath: string };
}> {
  const sourceDir = path.dirname(filePath);
  const parentOfSource = path.dirname(sourceDir);
  const baseName = path.basename(sourceDir) || 'Output';

  let attempt = 0;
  let destDir: string;
  while (true) {
    const suffix =
      attempt === 0 ? '_FixedDates' : `_FixedDates-${attempt + 1}`;
    destDir = path.join(parentOfSource, `${baseName}${suffix}`);
    if (!(await pathExists(destDir))) break;
    attempt++;
  }

  await fs.cp(sourceDir, destDir, { recursive: true });

  return {
    targetPath: path.join(destDir, path.basename(filePath)),
    copiedDirectory: { sourcePath: sourceDir, destinationPath: destDir },
  };
}

const inspectCmd = new Command('inspect')
  .description(
    'print JSON describing candidate date sources for one media file (for UI tools)',
  )
  .argument('<file>', 'media file path')
  .option(
    '-c, --cwd <cwd>',
    'working directory for resolving relative paths',
    process.cwd(),
  )
  .action(async (file: string, opts: { cwd: string }) => {
    try {
      const absPath = path.resolve(opts.cwd, file);
      try {
        await fs.access(absPath);
      } catch {
        process.stdout.write(
          `${JSON.stringify({ error: 'file_not_found', path: absPath })}\n`,
        );
        process.exit(1);
      }
      const st = await fs.stat(absPath);
      if (!st.isFile()) {
        process.stdout.write(
          `${JSON.stringify({ error: 'not_a_file', path: absPath })}\n`,
        );
        process.exit(1);
      }
      const result = await inspectMediaDates(absPath);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (err) {
      process.stdout.write(
        `${JSON.stringify({
          error: 'inspect_failed',
          message: err instanceof Error ? err.message : String(err),
        })}\n`,
      );
      process.exit(1);
    }
  });

const applyCmd = new Command('apply')
  .description(
    'write embedded and filesystem dates from an explicit Unix timestamp (manual override)',
  )
  .argument('<file>', 'media file path')
  .requiredOption(
    '--unix <seconds>',
    'unix timestamp in seconds (UTC)',
    (v: string) => {
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) throw new Error('--unix must be an integer');
      return n;
    },
  )
  .option(
    '--overwrite-original',
    'write into the original file instead of copying to a sibling directory',
  )
  .option('--google-takeout', 'reserved for future Google Takeout GPS support')
  .option('--jsonl', 'emit machine-readable output')
  .option(
    '-c, --cwd <cwd>',
    'working directory for resolving relative paths',
    process.cwd(),
  )
  .action(
    async (
      file: string,
      opts: {
        cwd: string;
        unix: number;
        overwriteOriginal?: boolean;
        jsonl?: boolean;
      },
    ) => {
      const output = createCliOutput(Boolean(opts.jsonl));

      try {
        await validateTools();
        const absPath = path.resolve(opts.cwd, file);

        try {
          await fs.access(absPath);
        } catch {
          output.error('File not found.', 'file_not_found');
          process.exit(1);
        }

        const st = await fs.stat(absPath);
        if (!st.isFile()) {
          output.error('Path is not a file.', 'not_a_file');
          process.exit(1);
        }

        let targetPath = absPath;
        let copiedDirectory:
          | { sourcePath: string; destinationPath: string }
          | undefined;

        if (!opts.overwriteOriginal) {
          const copy = await copyFileToSiblingDirectory(absPath);
          targetPath = copy.targetPath;
          copiedDirectory = copy.copiedDirectory;
        }

        await fixDatesFromTimestamp(targetPath, opts.unix);

        if (opts.jsonl) {
          process.stdout.write(
            `${JSON.stringify({ ok: true, targetPath, copiedDirectory })}\n`,
          );
          return;
        }

        output.success(`Applied date to ${path.basename(targetPath)}`);
        if (copiedDirectory) {
          output.info(`Copied to: ${copiedDirectory.destinationPath}`);
        }
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );

const optionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
});

type Options = z.infer<typeof optionsSchema>;

export const fixDates = new Command()
  .name('fix-dates')
  .description('recover/fix creation dates on media files (photos and videos)')
  .addCommand(inspectCmd)
  .addCommand(applyCmd)
  .argument('[paths...]', 'directories or files to fix', ['.'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .option(
    '--overwrite-original',
    'write into original files (default; flag accepted for compatibility)',
  )
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
        output.error('No valid paths provided.', 'no_valid_paths');
        process.exit(1);
      }

      const files = existingPaths.filter((p) => p.stat?.isFile());
      const directories = existingPaths.filter((p) => p.stat?.isDirectory());

      let videoFiles: string[] = [];
      let imageFiles: string[] = [];

      for (const dir of directories) {
        await collectMediaFilesRecursive(dir.path, videoFiles, imageFiles);
      }

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

      for (const file of videoFiles) {
        const baseName = path.basename(file);

        try {
          if (await hasValidCreateDate(file)) {
            logOk(`OK · ${baseName}`);
            alreadyOkCount++;
            continue;
          }

          try {
            await fixDatesInPlace(file);
          } catch {
            // Writing not supported for this format
          }

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

      for (const file of imageFiles) {
        const baseName = path.basename(file);

        try {
          if (
            (await hasValidPhotoDate(file)) &&
            (await hasUsablePhotoExifFileDates(file))
          ) {
            logOk(`OK · ${baseName}`);
            alreadyOkCount++;
            continue;
          }

          try {
            await fixDatesOnPhoto(file);
          } catch {
            // Writing not supported for this format
          }

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
