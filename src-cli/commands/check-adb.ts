import { Command } from 'commander';

export const checkAdb = new Command()
  .name('check-adb')
  .description('verify adb connection')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
