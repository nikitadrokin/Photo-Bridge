import { Command } from 'commander';

export const copy = new Command()
  .name('copy')
  .description('copy converted media to sibling directory')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
