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
