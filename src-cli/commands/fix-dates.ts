import { promises as fs, type Stats } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { createCliOutput, type CliOutput } from '../utils/logger.js';
import {
  copyPathsToSiblingDirectories,
  type ExistingPathEntry,
  type SiblingDirectoryMapping,
} from '../utils/sibling-directory.js';
import { validateTools } from '../utils/validation.js';
import {
  fixDatesInPlace,
  fixDatesOnPhoto,
  fixDatesFromTimestamp,
  hasValidCreateDate,
  inspectMediaDates,
  photoEmbeddedFileDatesAlreadyOk,
} from '../utils/dates.js';

const VIDEO_EXTENSIONS = new Set(['mov', 'mp4', 'm4v', 'mpg', 'mpeg']);
const IMAGE_EXTENSIONS = new Set([
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'dng',
]);

type ExistingPath = {
  exists: true;
  path: string;
  stat: Stats;
};

interface WorkingPaths {
  paths: ExistingPath[];
  copiedDirectories: SiblingDirectoryMapping[];
}

/** Recursively collect media files from `dirPath`, sorted into video/image buckets. */
async function collectMediaFiles(
  dirPath: string,
): Promise<{ videos: string[]; images: string[] }> {
  const videos: string[] = [];
  const images: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().slice(1);
        if (VIDEO_EXTENSIONS.has(ext)) videos.push(full);
        else if (IMAGE_EXTENSIONS.has(ext)) images.push(full);
      }
    }
  }

  await walk(dirPath);
  return { videos, images };
}

async function prepareCopiedWorkingPaths(
  existingPaths: ExistingPathEntry[],
): Promise<WorkingPaths> {
  const copied = await copyPathsToSiblingDirectories(
    existingPaths,
    '_FixedDates',
  );
  const paths = await Promise.all(
    copied.processingPaths.map(async (processingPath) => ({
      exists: true as const,
      path: processingPath,
      stat: await fs.stat(processingPath),
    })),
  );
  return { paths, copiedDirectories: copied.roots };
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
  const copied = await copyPathsToSiblingDirectories(
    [{ path: filePath, stat: await fs.stat(filePath) }],
    '_FixedDates',
  );
  const targetPath = copied.processingPaths[0];
  const copiedDirectory = copied.roots[0];
  if (!targetPath || !copiedDirectory) {
    throw new Error(`Could not copy ${filePath}`);
  }
  return {
    targetPath,
    copiedDirectory,
  };
}

async function validateFilePath(absPath: string): Promise<void> {
  try {
    await fs.access(absPath);
  } catch {
    throw new Error('File not found.');
  }

  const stat = await fs.stat(absPath);
  if (!stat.isFile()) throw new Error('Path is not a file.');
}

type ProcessResult = 'ok' | 'fixed' | 'failed';

/** Attempt to fix the date on a single file. Shared logic for videos and images. */
async function processMediaFile(
  file: string,
  alreadyOk: () => Promise<boolean>,
  fixInPlace: () => Promise<void>,
  verifyFixed: () => Promise<boolean>,
  output: CliOutput,
  logOk: (msg: string) => void,
  logFixed: (msg: string) => void,
): Promise<ProcessResult> {
  const baseName = path.basename(file);
  try {
    if (await alreadyOk()) {
      logOk(`OK · ${baseName}`);
      return 'ok';
    }
    try {
      await fixInPlace();
    } catch {
      // Writing not supported for this format
    }
    if (await verifyFixed()) {
      logFixed(`Fixed · ${baseName}`);
      return 'fixed';
    }
    output.warn(`Failed · ${baseName} · no valid source date found`);
    return 'failed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    output.warn(
      msg.includes('not yet supported')
        ? `Skipped · ${baseName} · format not writable`
        : `Failed · ${baseName} · ${msg}`,
    );
    return 'failed';
  }
}

// ─── inspect subcommand ────────────────────────────────────────────────────────

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
        await validateFilePath(absPath);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(
          `${JSON.stringify({
            error:
              message === 'Path is not a file.' ? 'not_a_file' : 'file_not_found',
            path: absPath,
          })}\n`,
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

// ─── apply subcommand ──────────────────────────────────────────────────────────

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
          await validateFilePath(absPath);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          output.error(
            message,
            message === 'Path is not a file.' ? 'not_a_file' : 'file_not_found',
          );
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

// ─── fix-dates (batch) ─────────────────────────────────────────────────────────

export const fixDates = new Command()
  .name('fix-dates')
  .description('recover/fix creation dates on media files (photos and videos)')
  .addCommand(inspectCmd)
  .addCommand(applyCmd)
  .argument('[paths...]', 'directories or files to fix', ['.'])
  .option('-c, --cwd <cwd>', 'the working directory', process.cwd())
  .option('--jsonl', 'enable JSON output for UI integration')
  .option(
    '--overwrite-original',
    'write into original files instead of copying to sibling _FixedDates folders',
  )
  .action(
    async (
      paths: string[],
      opts: { cwd: string; jsonl?: boolean; overwriteOriginal?: boolean },
    ) => {
      const cwd = path.resolve(opts.cwd);
      const output = createCliOutput(Boolean(opts.jsonl));

      try {
        const resolvedPaths = paths.map((p) => path.resolve(cwd, p));

        const pathStats = await Promise.all(
          resolvedPaths.map(async (p) => {
            try {
              return { path: p, stat: await fs.stat(p), exists: true as const };
            } catch {
              return { path: p, stat: null, exists: false };
            }
          }),
        );

        const existingPaths = pathStats.filter(
          (p): p is ExistingPath => p.exists && p.stat !== null,
        );
        if (existingPaths.length === 0) {
          output.error('No valid paths provided.', 'no_valid_paths');
          process.exit(1);
        }

        const working = opts.overwriteOriginal
          ? { paths: existingPaths, copiedDirectories: [] }
          : await prepareCopiedWorkingPaths(existingPaths);

        const videos: string[] = [];
        const images: string[] = [];

        for (const entry of working.paths) {
          if (entry.stat?.isDirectory()) {
            const collected = await collectMediaFiles(entry.path);
            videos.push(...collected.videos);
            images.push(...collected.images);
          } else if (entry.stat?.isFile()) {
            const ext = path.extname(entry.path).toLowerCase().slice(1);
            if (VIDEO_EXTENSIONS.has(ext)) videos.push(entry.path);
            else if (IMAGE_EXTENSIONS.has(ext)) images.push(entry.path);
          }
        }

        const totalFiles = videos.length + images.length;
        if (totalFiles === 0) {
          output.error('No media files found.', 'no_media_files');
          process.exit(1);
        }

        if (output.jsonl) {
          output.log(
            `Fixing ${totalFiles} file(s) (${videos.length} video(s), ${images.length} photo(s))`,
          );
        } else {
          output.blankLine();
          output.info('Source');
          output.indentedMuted(`${existingPaths.length} path(s)`);
          output.info('Destination');
          output.indentedMuted(
            opts.overwriteOriginal
              ? 'In-place (input files updated)'
              : 'Sibling _FixedDates folder(s)',
          );
          for (const copied of working.copiedDirectories) {
            output.indentedMuted(
              `${copied.sourcePath} -> ${copied.destinationPath}`,
            );
          }
          output.info('Mode');
          output.indentedMuted(
            'Restore file dates from embedded EXIF/QuickTime tags',
          );
          output.blankLine();
          output.info('Files');
          output.indentedMuted(
            `${totalFiles} total (${videos.length} video(s), ${images.length} photo(s))`,
          );
          output.blankLine();
        }

        await validateTools();

        const logOk = (msg: string) =>
          output.jsonl ? output.log(msg) : output.muted(msg);
        const logFixed = (msg: string) =>
          output.jsonl ? output.success(msg) : output.muted(msg);

        let fixed = 0;
        let ok = 0;
        let failed = 0;

        const tally = (r: ProcessResult) => {
          if (r === 'fixed') fixed++;
          else if (r === 'ok') ok++;
          else failed++;
        };

        for (const file of videos) {
          tally(
            await processMediaFile(
              file,
              () => hasValidCreateDate(file),
              () => fixDatesInPlace(file),
              () => hasValidCreateDate(file),
              output,
              logOk,
              logFixed,
            ),
          );
        }

        for (const file of images) {
          tally(
            await processMediaFile(
              file,
              () => photoEmbeddedFileDatesAlreadyOk(file),
              () => fixDatesOnPhoto(file),
              () => photoEmbeddedFileDatesAlreadyOk(file),
              output,
              logOk,
              logFixed,
            ),
          );
        }

        output.blankLine();
        output.success(`Done · ${fixed} fixed, ${ok} OK, ${failed} failed`);
        for (const copied of working.copiedDirectories) {
          output.info(`Updated copy: ${copied.destinationPath}`);
        }
        output.blankLine();
      } catch (error) {
        output.blankLine();
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    },
  );
