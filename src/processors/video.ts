import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../utils/logger.js';
import { copyDatesFromSource, hasValidCreateDate } from '../utils/dates.js';
import { processSpatialVideo } from '../pipeline/convert.js';

/**
 * Process a video file with spatial audio-aware conversion and metadata archival.
 *
 * Licensing note: Dolby Atmos authoring requires licensed Dolby encoders.
 * Licensing note: APAC/ASAF is proprietary Apple technology and is not reverse engineered here.
 */
export async function processVideo(
  inputPath: string,
  outputPath: string,
  attemptAtmos = false,
): Promise<void> {
  const baseName = path.basename(inputPath);

  logger.log(`VIDEO: ${baseName} -> ${path.basename(outputPath)}`);

  try {
    await processSpatialVideo(inputPath, {
      outputPath,
      attemptAtmos,
    });

    await copyDatesFromSource(inputPath, outputPath);

    if (!(await hasValidCreateDate(outputPath))) {
      logger.warn(
        `⚠️  WARNING: Could not recover creation date for ${baseName} - metadata may need manual correction`,
      );
    }
  } catch (error) {
    logger.error(`❌ ERROR: Failed to convert ${baseName}`);
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Process a video file by copying it bit-for-bit and renaming it to .mp4.
 *
 * This just tells macOS to copy the file bit-for-bit, only changing the .mov extension to .mp4:
 * - no ffmpeg
 * - no ffprobe
 * - no metadata rewrite
 * - no stream changes
 * - output may not be Pixel-compatible, we are testing if it just works by uploads in Google Photos
 */
export async function copyVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const baseName = path.basename(inputPath);

  logger.log(`VIDEO: ${baseName} -> Copying .mov to .mp4 container...`);

  try {
    // fs.copyFile throws errors if the file already exists
    // so we force remove it first
    await fs.rm(outputPath, { force: true });
    await fs.copyFile(inputPath, outputPath);
  } catch (error) {
    logger.error(`❌ ERROR: Failed to copy ${baseName}`);
    try {
      await fs.rm(outputPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
