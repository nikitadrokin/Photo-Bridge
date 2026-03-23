import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export const pullFromPixel = new Command()
  .name('pull-from-pixel')
  .alias('pull')
  .description('Pull files from Pixel Camera folder')
  .argument('[destination]', 'destination directory', '.')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (destination: string, opts) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    logger.info(`Pulling from device to: ${destination}`);

    try {
      const adb = execa('adb', ['pull', '/sdcard/DCIM/Camera/', destination]);

      // Stream adb output through logger
      adb.stdout?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          logger.log(line.trim());
        }
      });

      adb.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          logger.error(line.trim());
        }
      });

      await adb;
      logger.success('Pull complete');
    } catch (error) {
      logger.error('Failed to pull from device');
    }
  });
