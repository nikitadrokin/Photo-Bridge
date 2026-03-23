import { Command } from 'commander';
import { execa } from 'execa';

export const shell = new Command()
  .name('shell')
  .description('Launch an interactive ADB shell session')
  .action(async () => {
    try {
      await execa('adb', ['shell'], { stdio: 'inherit' });
    } catch (error) {
      // adb will have printed the error already due to stdio: inherit
    }
  });
