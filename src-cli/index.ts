#!/usr/bin/env node
import { Command } from 'commander';
import { convert } from './commands/convert/index.js';
import { copy } from './commands/copy.js';
import { checkAdb } from './commands/check-adb.js';
import { pushToPixel } from './commands/push-to-pixel.js';
import { pullFromPixel } from './commands/pull-from-pixel.js';
import { shell } from './commands/shell.js';
import { fixDates } from './commands/fix-dates.js';
import { fixSnapchatDates } from './commands/fix-snapchat-dates.js';
import { split } from './commands/split/index.js';
import { gallery } from './commands/gallery.js';
import { pixel } from './commands/pixel.js';

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
    .version('0.0.22');

  program.addCommand(convert);
  program.addCommand(copy);
  program.addCommand(checkAdb);
  program.addCommand(pushToPixel);
  program.addCommand(pullFromPixel);
  program.addCommand(shell);
  program.addCommand(fixDates);
  program.addCommand(fixSnapchatDates);
  program.addCommand(split);
  program.addCommand(gallery);
  program.addCommand(pixel);

  program.parse();
}

main();
