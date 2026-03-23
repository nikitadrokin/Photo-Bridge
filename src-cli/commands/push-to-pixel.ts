import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .alias('push')
  .description('Push files to Pixel Camera folder')
  .argument('<paths...>', 'files to push')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    for (const p of paths) {
      logger.info(`Pushing: ${p}`);
      try {
        const adb = execa('adb', ['push', p, '/sdcard/DCIM/Camera']);

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
        logger.success(`Pushed: ${p}`);
      } catch (error) {
        logger.error(`Failed to push: ${p}`);
      }
    }
  });
