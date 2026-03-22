import path from 'path';
import { promises as fs } from 'fs';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import { copyDatesFromSource, hasValidCreateDate } from '../utils/dates.js';

/**
 * Process a legacy video file (e.g. MPEG-1/2) by transcoding to H.264/AAC MP4
 */
export async function processLegacyVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const baseName = path.basename(inputPath);
  const jsonUi = logger.getMode() === 'json';

  if (!jsonUi) {
    logger.log(`LEGACY VIDEO: ${baseName} -> MP4 (Transcoding to H.264/AAC)`);
  }

  try {
    const ffmpeg = execa('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-stats',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-c:a',
      'aac',
      '-b:a',
      '320k',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '0',
      outputPath,
    ]);

    if (!jsonUi) {
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            logger.log(`  ${trimmed}`);
          }
        }
      });
    }

    await ffmpeg;

    // Fix dates using priority chain from source file
    await copyDatesFromSource(inputPath, outputPath);

    // Verify that dates were successfully recovered
    if (!(await hasValidCreateDate(outputPath))) {
      if (jsonUi) {
        logger.emitUi({
          v: 1,
          kind: 'warn',
          code: 'date_not_recovered',
          detail: baseName,
        });
      } else {
        logger.warn(
          `⚠️  WARNING: Could not recover creation date for ${baseName} - metadata may need manual correction`,
        );
      }
    }
  } catch (error) {
    if (!jsonUi) {
      logger.error(`❌ ERROR: Failed to convert ${baseName}`);
    }
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
