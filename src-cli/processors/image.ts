import { promises as fs } from 'node:fs';
import { fixDatesOnPhoto } from '../utils/dates.js';

/** Copies the image and restores filesystem dates from the best embedded photo date. */
export async function processImage(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await fs.copyFile(inputPath, outputPath);
  await fixDatesOnPhoto(outputPath);
}
