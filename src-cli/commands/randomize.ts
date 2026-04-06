import { Command } from 'commander';

export const randomize = new Command('randomize')
  .description('randomize file timestamps')
  .action(() => {
    console.log('this will be rewritten by hand');
  });
