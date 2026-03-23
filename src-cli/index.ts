#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from './commands/convert.js';
import { copy } from './commands/copy.js';
import { randomize } from './commands/randomize.js';
import { checkAdb } from './commands/check-adb.js';
import { pushToPixel } from './commands/push-to-pixel.js';
import { pullFromPixel } from './commands/pull-from-pixel.js';
import { shell } from './commands/shell.js';
import { fixDates } from './commands/fix-dates.js';

// Fix for macOS sidecar process not having access to Homebrew paths
if (process.platform === 'darwin') {
  const commonPaths = ['/opt/homebrew/bin', '/usr/local/bin'];
  process.env.PATH = [
    process.env.PATH,
    ...commonPaths.filter((p) => !process.env.PATH?.includes(p)),
  ].join(':');
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

async function main() {
  const program = new Command()
    .name('pb')
    .description('Convert iOS media files for Google Pixel 1 compatibility')
    .version('0.0.11');

  program.addCommand(convert);
  program.addCommand(copy);
  program.addCommand(randomize);
  program.addCommand(checkAdb);
  program.addCommand(pushToPixel);
  program.addCommand(pullFromPixel);
  program.addCommand(shell);
  program.addCommand(fixDates);

  program.parse();
}

main();
