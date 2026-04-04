import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { z } from 'zod';
import { processImage } from '../processors/image.js';
import { processVideo } from '../processors/video.js';
import { processLegacyVideo } from '../processors/legacy-video.js';
import { logger } from '../utils/logger.js';
import { prepareSiblingDirectory } from '../utils/sibling-directory.js';
import { validateTools } from '../utils/validation.js';
import { fixDatesOnPhoto } from '../utils/dates.js';
import { ConversionFileError } from '../utils/conversion-file-error.js';
import type { MediaType } from '../../types/protocol.js';

const convertOptionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
});

type ConvertOptions = z.infer<typeof convertOptionsSchema>;

// prettier-ignore
const IMAGE_EXTENSIONS = ['heic', 'heif', 'jpg', 'jpeg', 'png', 'gif', 'dng', 'webp'];
const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v'];
const LEGACY_VIDEO_EXTENSIONS = ['mpg', 'mpeg'];

function cliMediaKind(ext: string): MediaType {
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (LEGACY_VIDEO_EXTENSIONS.includes(ext)) return 'legacy_video';
  return 'video';
}

export const convert = new Command()
  .name('convert')
  .description('convert iOS media files to Pixel-compatible format')
  .argument('[paths...]', 'directory or files to convert', ['Part1'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts: ConvertOptions) => {
    try {
      const options = convertOptionsSchema.parse({
        cwd: path.resolve(opts.cwd),
        jsonl: opts.jsonl,
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
        if (options.jsonl) {
          logger.emitJSON({
            v: 1,
            kind: 'error',
            code: 'no_valid_paths',
          });
        } else {
          logger.error('No valid paths provided.');
        }
        process.exit(1);
      }

      const files = existingPaths.filter((p) => p.stat?.isFile());
      const directories = existingPaths.filter((p) => p.stat?.isDirectory());

      if (directories.length > 1) {
        if (options.jsonl) {
          logger.emitJSON({
            v: 1,
            kind: 'error',
            code: 'multiple_directories',
          });
        } else {
          logger.error(
            'Multiple directories provided. Please provide only one directory.',
          );
        }
        process.exit(1);
      }

      if (directories.length === 1 && files.length === 0) {
        await processDirectory(directories[0].path);
      } else if (files.length > 0) {
        await processIndividualFiles(files.map((f) => f.path));
      } else {
        if (options.jsonl) {
          logger.emitJSON({
            v: 1,
            kind: 'error',
            code: 'no_valid_inputs',
          });
        } else {
          logger.error('No valid files or directories provided.');
        }
        process.exit(1);
      }
    } catch (error) {
      if (logger.getMode() === 'json') {
        if (!(error instanceof ConversionFileError)) {
          logger.emitJSON({
            v: 1,
            kind: 'error',
            code: 'uncaught',
            detail: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        logger.break();
        logger.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

/** Prepares the sibling output directory used for directory-mode conversion. */
async function processDirectory(dirPath: string): Promise<void> {
  const inDir = path.resolve(dirPath);
  const outDir = await prepareSiblingDirectory(inDir, '_Remuxed', {
    create: true,
  });

  if (logger.getMode() !== 'json') {
    logger.break();
    logger.log('=========================================================');
    logger.info(`SOURCE:      ${inDir}`);
    logger.info(`DESTINATION: ${outDir}`);
    logger.info('MODE:        Copy MOV to MP4 container without re-encoding');
    logger.log('=========================================================');
    logger.break();
  }

  await validateTools();

  const files = await fs.readdir(inDir, { withFileTypes: true });
  const regularFiles = files
    .filter((f) => f.isFile() && !f.name.startsWith('.'))
    .map((f) => path.join(inDir, f.name));

  const { processedCount, skippedCount } = await processFiles(
    regularFiles,
    outDir,
  );

  if (logger.getMode() !== 'json') {
    logger.break();
    logger.log('=========================================================');
    logger.success(
      `DONE. Processed ${processedCount} files, skipped ${skippedCount}.`,
    );
    logger.info(`Transfer this folder to your Pixel: ${outDir}`);
    logger.log('=========================================================');
    logger.break();
  }
}

async function processIndividualFiles(filePaths: string[]): Promise<void> {
  const regularFiles = filePaths.filter((f) => {
    const ext = path.extname(f).toLowerCase().slice(1);
    return (
      IMAGE_EXTENSIONS.includes(ext) ||
      VIDEO_EXTENSIONS.includes(ext) ||
      LEGACY_VIDEO_EXTENSIONS.includes(ext)
    );
  });

  if (regularFiles.length === 0) {
    if (logger.getMode() === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'error',
        code: 'no_supported_media',
      });
    } else {
      logger.error('No supported media files provided.');
    }
    process.exit(1);
  }

  if (logger.getMode() !== 'json') {
    logger.break();
    logger.log('=========================================================');
    logger.info(`SOURCE:      ${regularFiles.length} file(s)`);
    logger.info(`DESTINATION: In-place (Output files next to input files)`);
    logger.info('MODE:        SPM-STYLE COPY/RENAME (Fake MP4)');
    logger.log('=========================================================');
    logger.break();
  }

  await validateTools();

  const { processedCount, skippedCount } = await processFiles(
    regularFiles,
    null,
  );

  if (logger.getMode() !== 'json') {
    logger.break();
    logger.log('=========================================================');
    logger.success(
      `DONE. Processed ${processedCount} files, skipped ${skippedCount}.`,
    );
    logger.log('=========================================================');
    logger.break();
  }
}

async function processFiles(
  files: string[],
  outDir: string | null,
): Promise<{ processedCount: number; skippedCount: number }> {
  let processedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const isJson = logger.getMode() === 'json';
  const layout = outDir ? 'directory' : 'files';

  if (isJson) {
    logger.emitJSON({
      v: 1,
      kind: 'session',
      phase: 'start',
      command: 'convert',
      layout,
      outputDir: outDir ?? undefined,
      total: files.length,
    });
  }

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const baseName = path.basename(file);
      const ext = path.extname(file).toLowerCase().slice(1);
      const outputDirectory = outDir ?? path.dirname(file);
      const media = cliMediaKind(ext);

      if (IMAGE_EXTENSIONS.includes(ext)) {
        const outFile = path.join(outputDirectory, baseName);

        if (outFile === file) {
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media: 'image',
              extIn: ext,
              extOut: ext,
              name: baseName,
              reason: 'output_same_as_input',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        }

        try {
          await fs.access(outFile);
          await fixDatesOnPhoto(outFile);
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media: 'image',
              extIn: ext,
              extOut: ext,
              name: baseName,
              reason: 'output_exists',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        } catch {
          // File doesn't exist, proceed
        }

        try {
          await processImage(file, outFile);
          processedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'done',
              media: 'image',
              extIn: ext,
              extOut: ext,
              name: baseName,
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
        } catch (err) {
          failedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'failed',
              media: 'image',
              extIn: ext,
              extOut: ext,
              name: baseName,
              reason: 'processing_error',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          throw new ConversionFileError(
            err instanceof Error ? err.message : String(err),
          );
        }
        continue;
      }

      if (VIDEO_EXTENSIONS.includes(ext)) {
        const stem = path.basename(file, path.extname(file));
        const outFile = path.join(outputDirectory, `${stem}.mp4`);

        if (outFile === file) {
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media,
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'output_same_as_input',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        }

        try {
          await fs.access(outFile);
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media,
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'output_exists',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        } catch {
          // File doesn't exist, proceed
        }

        try {
          const wrote = await processVideo(file, outFile);
          if (!wrote) {
            skippedCount++;
            if (isJson) {
              logger.emitJSON({
                v: 1,
                kind: 'file',
                status: 'skipped',
                media,
                extIn: ext,
                extOut: 'mp4',
                name: baseName,
                reason: 'unreadable_video',
              });
            }
          } else {
            processedCount++;
            if (isJson) {
              logger.emitJSON({
                v: 1,
                kind: 'file',
                status: 'done',
                media,
                extIn: ext,
                extOut: 'mp4',
                name: baseName,
              });
            }
          }
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
        } catch (err) {
          failedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'failed',
              media,
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'processing_error',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          throw new ConversionFileError(
            err instanceof Error ? err.message : String(err),
          );
        }
        continue;
      }

      if (LEGACY_VIDEO_EXTENSIONS.includes(ext)) {
        const stem = path.basename(file, path.extname(file));
        const outFile = path.join(outputDirectory, `${stem}.mp4`);

        if (outFile === file) {
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media: 'legacy_video',
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'output_same_as_input',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        }

        try {
          await fs.access(outFile);
          skippedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'skipped',
              media: 'legacy_video',
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'output_exists',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          continue;
        } catch {
          // File doesn't exist, proceed
        }

        try {
          await processLegacyVideo(file, outFile);
          processedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'done',
              media: 'legacy_video',
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
        } catch (err) {
          failedCount++;
          if (isJson) {
            logger.emitJSON({
              v: 1,
              kind: 'file',
              status: 'failed',
              media: 'legacy_video',
              extIn: ext,
              extOut: 'mp4',
              name: baseName,
              reason: 'processing_error',
            });
            logger.emitJSON({
              v: 1,
              kind: 'progress',
              done: i + 1,
              total: files.length,
            });
          }
          throw new ConversionFileError(
            err instanceof Error ? err.message : String(err),
          );
        }
        continue;
      }

      if (isJson) {
        logger.emitJSON({
          v: 1,
          kind: 'progress',
          done: i + 1,
          total: files.length,
        });
      }
    }

    return { processedCount, skippedCount };
  } finally {
    if (isJson) {
      logger.emitJSON({
        v: 1,
        kind: 'session',
        phase: 'end',
        command: 'convert',
        layout,
        outputDir: outDir ?? undefined,
        total: files.length,
        processed: processedCount,
        skipped: skippedCount,
        failed: failedCount,
      });
    }
  }
}
