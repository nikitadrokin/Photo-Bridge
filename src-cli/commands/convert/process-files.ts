import { promises as fs } from 'node:fs';
import path from 'node:path';
import { processImage } from '../../processors/image.js';
import { processVideo } from '../../processors/video.js';
import { processLegacyVideo } from '../../processors/legacy-video.js';
import { fixDatesOnPhoto } from '../../utils/dates.js';
import { ConversionFileError } from '../../utils/conversion-file-error.js';
import type { CliOutput } from '../../utils/logger.js';
import type { MediaType } from '../../../types/protocol.js';
import {
  cliMediaKind,
  isImageExtension,
  isLegacyVideoExtension,
  isSupportedMediaExtension,
  isVideoExtension,
} from './media.js';
import { ConvertRunReporter } from './reporter.js';

async function skipIfOutputAlreadyHandled(
  outFile: string,
  refreshDatesWhenImage: boolean,
): Promise<boolean> {
  try {
    await fs.access(outFile);
    if (refreshDatesWhenImage) {
      await fixDatesOnPhoto(outFile);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Runs the convert loop: session events, per-file work, and counters used for the summary row.
 */
export async function runConvertProcessFiles(
  files: string[],
  outDir: string | null,
  output: CliOutput,
): Promise<{ processedCount: number; skippedCount: number }> {
  let processedCount = 0;
  let skippedCount = 0;
  /** Shared so a throw after `failed` file events still reports correct `session` end counts. */
  const failureCount = { n: 0 };
  const layout = outDir ? 'directory' : 'files';
  const reporter = new ConvertRunReporter(output, layout, outDir, files.length);

  reporter.start();

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const baseName = path.basename(file);
      const ext = path.extname(file).toLowerCase().slice(1);
      const outputDirectory = outDir ?? path.dirname(file);
      const done = i + 1;

      if (!isSupportedMediaExtension(ext)) {
        reporter.progressOnly(done);
        continue;
      }

      const media = cliMediaKind(ext);

      if (isImageExtension(ext)) {
        const outcome = await runImageConversion({
          file,
          baseName,
          ext,
          outputDirectory,
          reporter,
          done,
          failureCount,
        });
        if (outcome === 'skipped') skippedCount++;
        else if (outcome === 'processed') processedCount++;
        continue;
      }

      if (isVideoExtension(ext)) {
        const outcome = await runVideoLikeConversion({
          file,
          baseName,
          ext,
          media,
          outputDirectory,
          reporter,
          done,
          legacy: false,
          failureCount,
        });
        if (outcome === 'skipped') skippedCount++;
        else if (outcome === 'processed') processedCount++;
        continue;
      }

      if (isLegacyVideoExtension(ext)) {
        const outcome = await runVideoLikeConversion({
          file,
          baseName,
          ext,
          media: 'legacy_video',
          outputDirectory,
          reporter,
          done,
          legacy: true,
          failureCount,
        });
        if (outcome === 'skipped') skippedCount++;
        else if (outcome === 'processed') processedCount++;
        continue;
      }
    }

    return { processedCount, skippedCount };
  } finally {
    reporter.end({
      processed: processedCount,
      skipped: skippedCount,
      failed: failureCount.n,
    });
  }
}

async function runImageConversion(args: {
  file: string;
  baseName: string;
  ext: string;
  outputDirectory: string;
  reporter: ConvertRunReporter;
  done: number;
  failureCount: { n: number };
}): Promise<'processed' | 'skipped'> {
  const { file, baseName, ext, outputDirectory, reporter, done, failureCount } =
    args;
  const outFile = path.join(outputDirectory, baseName);

  if (outFile === file) {
    reporter.fileProgress(
      {
        status: 'skipped',
        media: 'image',
        extIn: ext,
        extOut: ext,
        name: baseName,
        reason: 'output_same_as_input',
      },
      done,
    );
    return 'skipped';
  }

  if (await skipIfOutputAlreadyHandled(outFile, true)) {
    reporter.fileProgress(
      {
        status: 'skipped',
        media: 'image',
        extIn: ext,
        extOut: ext,
        name: baseName,
        reason: 'output_exists',
      },
      done,
    );
    return 'skipped';
  }

  try {
    await processImage(file, outFile);
    reporter.fileProgress(
      {
        status: 'done',
        media: 'image',
        extIn: ext,
        extOut: ext,
        name: baseName,
      },
      done,
    );
    return 'processed';
  } catch (err) {
    failureCount.n += 1;
    reporter.fileProgress(
      {
        status: 'failed',
        media: 'image',
        extIn: ext,
        extOut: ext,
        name: baseName,
        reason: 'processing_error',
      },
      done,
    );
    throw new ConversionFileError(
      err instanceof Error ? err.message : String(err),
    );
  }
}

async function runVideoLikeConversion(args: {
  file: string;
  baseName: string;
  ext: string;
  media: MediaType;
  outputDirectory: string;
  reporter: ConvertRunReporter;
  done: number;
  legacy: boolean;
  failureCount: { n: number };
}): Promise<'processed' | 'skipped'> {
  const {
    file,
    baseName,
    ext,
    media,
    outputDirectory,
    reporter,
    done,
    legacy,
    failureCount,
  } = args;
  const stem = path.basename(file, path.extname(file));
  const outFile = path.join(outputDirectory, `${stem}.mp4`);

  if (outFile === file) {
    reporter.fileProgress(
      {
        status: 'skipped',
        media,
        extIn: ext,
        extOut: 'mp4',
        name: baseName,
        reason: 'output_same_as_input',
      },
      done,
    );
    return 'skipped';
  }

  if (await skipIfOutputAlreadyHandled(outFile, false)) {
    reporter.fileProgress(
      {
        status: 'skipped',
        media,
        extIn: ext,
        extOut: 'mp4',
        name: baseName,
        reason: 'output_exists',
      },
      done,
    );
    return 'skipped';
  }

  try {
    if (legacy) {
      await processLegacyVideo(file, outFile);
    } else {
      const wrote = await processVideo(file, outFile);
      if (!wrote) {
        reporter.fileProgress(
          {
            status: 'skipped',
            media,
            extIn: ext,
            extOut: 'mp4',
            name: baseName,
            reason: 'unreadable_video',
          },
          done,
        );
        return 'skipped';
      }
    }

    reporter.fileProgress(
      {
        status: 'done',
        media,
        extIn: ext,
        extOut: 'mp4',
        name: baseName,
      },
      done,
    );
    return 'processed';
  } catch (err) {
    failureCount.n += 1;
    reporter.fileProgress(
      {
        status: 'failed',
        media,
        extIn: ext,
        extOut: 'mp4',
        name: baseName,
        reason: 'processing_error',
      },
      done,
    );
    throw new ConversionFileError(
      err instanceof Error ? err.message : String(err),
    );
  }
}
