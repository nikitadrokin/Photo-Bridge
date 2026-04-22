import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { z } from 'zod';
import { createCliOutput, type CliOutput } from '../../utils/logger.js';
import { validateTools } from '../../utils/validation.js';
import { applyDateCmd } from './apply.js';
import {
  collectMediaFilesRecursive,
  IMAGE_EXT_SET,
  VIDEO_EXT_SET,
} from './collect-media.js';
import { inspectDatesCmd } from './inspect.js';
import { runFixDatesBatch } from './run-batch.js';
import type { SiblingDirectoryMapping } from './working-copy.js';
import { copyPathsToSiblingDirectories } from './working-copy.js';

const optionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
  googleTakeout: z.boolean().optional(),
  overwriteOriginal: z.boolean().optional(),
});

type Options = z.infer<typeof optionsSchema>;

export const fixDates = new Command()
  .name('fix-dates')
  .description('recover/fix creation dates on media files (photos and videos)')
  .addCommand(inspectDatesCmd)
  .addCommand(applyDateCmd)
  .argument('[paths...]', 'directories or files to fix', ['.'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .option(
    '--google-takeout',
    'enable Google Takeout mode: write GPS coordinates from JSON sidecars and sync filesystem timestamps',
  )
  .option(
    '--overwrite-original',
    'write metadata into the original files instead of copying source folders first',
  )
  .action(async (paths: string[], opts: Options) => {
    const options = optionsSchema.parse({
      cwd: path.resolve(opts.cwd),
      jsonl: opts.jsonl,
      googleTakeout: opts.googleTakeout,
      overwriteOriginal: opts.overwriteOriginal,
    });
    const output = createCliOutput(Boolean(options.jsonl));

    try {
      const resolvedPaths = paths.map((p) => path.resolve(options.cwd, p));

      const pathStats = await Promise.all(
        resolvedPaths.map(async (p) => {
          try {
            const stat = await fs.stat(p);
            return { path: p, stat, exists: true as const };
          } catch {
            return { path: p, stat: null, exists: false as const };
          }
        }),
      );

      const existingPaths = pathStats.filter(
        (
          p,
        ): p is {
          path: string;
          stat: NonNullable<(typeof pathStats)[number]['stat']>;
          exists: true;
        } => p.exists && p.stat !== null,
      );
      if (existingPaths.length === 0) {
        output.error('No valid paths provided.', 'no_valid_paths');
        process.exit(1);
      }

      await validateTools();

      let processingPaths = existingPaths;
      let copyRoots: Array<SiblingDirectoryMapping> = [];

      if (!options.overwriteOriginal) {
        const workingCopy = await copyPathsToSiblingDirectories(
          existingPaths,
          '_FixedDates',
        );
        processingPaths = await Promise.all(
          workingCopy.processingPaths.map(async (processingPath) => ({
            path: processingPath,
            stat: await fs.stat(processingPath),
            exists: true as const,
          })),
        );
        copyRoots = workingCopy.roots;
      }

      const files = processingPaths.filter((p) => p.stat.isFile());
      const directories = processingPaths.filter((p) => p.stat.isDirectory());

      let videoFiles: string[] = [];
      let imageFiles: string[] = [];

      for (const dir of directories) {
        await collectMediaFilesRecursive(dir.path, videoFiles, imageFiles);
      }

      for (const file of files) {
        const ext = path.extname(file.path).toLowerCase().slice(1);
        if (VIDEO_EXT_SET.has(ext)) {
          videoFiles.push(file.path);
        } else if (IMAGE_EXT_SET.has(ext)) {
          imageFiles.push(file.path);
        }
      }

      videoFiles = [...new Set(videoFiles)];
      imageFiles = [...new Set(imageFiles)];

      const totalFiles = videoFiles.length + imageFiles.length;
      if (totalFiles === 0) {
        output.error('No media files found.', 'no_media_files');
        process.exit(1);
      }

      printBatchHeader(output, videoFiles, imageFiles, options, copyRoots);

      if (options.googleTakeout) {
        output.warn('Warning: Google Takeout mode is experimental.');
        output.blankLine();
      }

      const { fixedCount, alreadyOkCount, failedCount } = await runFixDatesBatch(
        videoFiles,
        imageFiles,
        { googleTakeout: Boolean(options.googleTakeout) },
        output,
      );

      printBatchFooter(
        output,
        fixedCount,
        alreadyOkCount,
        failedCount,
        copyRoots,
      );
    } catch (error) {
      output.blankLine();
      output.error(
        error instanceof Error ? error.message : String(error),
        'uncaught',
      );
      process.exit(1);
    }
  });

function printBatchHeader(
  output: CliOutput,
  videoFiles: string[],
  imageFiles: string[],
  options: Options,
  copyRoots: Array<SiblingDirectoryMapping>,
): void {
  output.blankLine();
  output.log('=========================================================');
  output.info(
    `Fixing dates on ${videoFiles.length} video(s) and ${imageFiles.length} photo(s)`,
  );
  output.info(
    options.overwriteOriginal
      ? 'Write mode: overwrite original files'
      : 'Write mode: edit copies of original files',
  );
  for (const copyRoot of copyRoots) {
    output.info(`Copy: ${copyRoot.sourcePath} -> ${copyRoot.destinationPath}`);
  }
  output.log('=========================================================');
  output.blankLine();
}

function printBatchFooter(
  output: CliOutput,
  fixedCount: number,
  alreadyOkCount: number,
  failedCount: number,
  copyRoots: Array<SiblingDirectoryMapping>,
): void {
  output.blankLine();
  output.log('=========================================================');
  output.success(
    `DONE. Fixed: ${fixedCount}, Already OK: ${alreadyOkCount}, Failed: ${failedCount}`,
  );
  for (const copyRoot of copyRoots) {
    output.info(`Updated copy: ${copyRoot.destinationPath}`);
  }
  output.log('=========================================================');
  output.blankLine();
}
