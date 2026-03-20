import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export async function runFfmpeg(args: string[]): Promise<void> {
  const proc = execa('ffmpeg', ['-y', ...args]);

  proc.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n').filter(Boolean)) {
      logger.log(`  ${line.trim()}`);
    }
  });

  await proc;
}
