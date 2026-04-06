import { Command } from 'commander';

export const pullFromPixel = new Command()
  .name('pull-from-pixel')
  .description('pull media from Pixel device')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
