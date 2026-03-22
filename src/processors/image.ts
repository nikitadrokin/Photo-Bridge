import { promises as fs } from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';
import { fixDatesOnPhoto } from '../utils/dates.js';

/**
 * Process an image file by copying it and fixing metadata dates
 */
export async function processImage(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const baseName = path.basename(inputPath);

  if (logger.getMode() !== 'json') {
    logger.log(`PHOTO: ${baseName} -> Copying (Bit-for-bit)...`);
  }

  // Copy file exactly
  await fs.copyFile(inputPath, outputPath);

  // Fix filesystem dates using the priority chain from dates.ts
  // This ensures Google Photos sorts by capture date, not today
  await fixDatesOnPhoto(outputPath);
}
