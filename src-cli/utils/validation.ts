import { execa } from 'execa';
import { resolveTool } from './tool-paths';

/** Ensures FFmpeg and ExifTool are on PATH before conversion work. */
export async function validateTools(): Promise<void> {
  await execa(resolveTool('ffmpeg'), ['-version'], { stdio: 'ignore' });
  await execa(resolveTool('exiftool'), ['-ver'], { stdio: 'ignore' });
}
