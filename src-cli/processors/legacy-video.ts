import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { resolveTool } from '../utils/tool-paths';
import { copyDatesFromSource } from '../utils/dates.js';

/** Transcodes legacy MPEG-style inputs into H.264/AAC MP4 for Pixel playback. */
export async function processLegacyVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  try {
    await execa(resolveTool('ffmpeg'), [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '18',
      '-pix_fmt',
      'yuv420p',
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
  } catch (error) {
    await fs.rm(outputPath, { force: true });

    throw error;
  }

  await copyDatesFromSource(inputPath, outputPath);
}
