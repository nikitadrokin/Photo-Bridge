import { Command } from 'commander';

export const fixSnapchatDates = new Command()
  .name('fix-snapchat-dates')
  .description('fix Snapchat export date metadata')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
