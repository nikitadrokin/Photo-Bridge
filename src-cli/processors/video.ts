import { execa } from 'execa';

/**
 * Remuxes video into MP4 without re-encoding when possible.
 * @returns false when FFmpeg cannot read the source (treated as skip).
 */
export async function processVideo(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  try {
    await execa(
      'ffmpeg',
      ['-hide_banner', '-loglevel', 'error', '-y', '-i', inputPath, '-c', 'copy', outputPath],
      { stdio: 'ignore' },
    );
    return true;
  } catch {
    return false;
  }
}
