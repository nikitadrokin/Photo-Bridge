import { execa } from 'execa';

/** Transcodes legacy MPEG-style inputs into H.264/AAC MP4 for Pixel playback. */
export async function processLegacyVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  await execa(
    'ffmpeg',
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-y',
      '-i',
      inputPath,
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      outputPath,
    ],
    { stdio: 'ignore' },
  );
}
