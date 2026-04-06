import { Command } from 'commander';

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .description('push media to Pixel device')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
