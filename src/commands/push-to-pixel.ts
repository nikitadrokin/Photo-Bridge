import { Command } from 'commander';
import { logger } from '../utils/logger.js';
import { pushToPixelCamera } from '../pipeline/pixel_push.js';

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .alias('push')
  .description('Push files to Pixel Camera folder and trigger media scanner')
  .argument('<paths...>', 'files to push')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    for (const p of paths) {
      logger.info(`Pushing: ${p}`);
      const result = await pushToPixelCamera(p);
      if (result.ok) {
        logger.success(`Pushed: ${p}`);
      } else {
        logger.error(`Failed to push: ${p}`);
      }
    }
  });
