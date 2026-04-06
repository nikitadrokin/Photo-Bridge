import { Command } from 'commander';

export const shell = new Command()
  .name('shell')
  .description('open adb shell on device')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
