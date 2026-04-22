import { promises as fs } from 'node:fs';

/** Copies the image to the destination path (container-safe for Pixel HEIC/JPEG flows). */
export async function processImage(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await fs.copyFile(inputPath, outputPath);
}
