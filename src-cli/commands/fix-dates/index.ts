import { Command } from 'commander';

export const fixDates = new Command()
  .name('fix-dates')
  .description('recover/fix creation dates on media files (photos and videos)')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
