import { execa } from 'execa';

/** Ensures FFmpeg and ExifTool are on PATH before conversion work. */
export async function validateTools(): Promise<void> {
  await execa('ffmpeg', ['-version'], { stdio: 'ignore' });
  await execa('exiftool', ['-ver'], { stdio: 'ignore' });
}
