import { Command } from 'commander';

export const convert = new Command()
  .name('convert')
  .description('convert iOS media files to Pixel-compatible format')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
