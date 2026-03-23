import { Command } from 'commander';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export const checkAdb = new Command()
  .name('check-adb')
  .description('Check if an ADB device is connected')
  .action(async () => {
    try {
      const { stdout } = await execa('adb', ['devices']);
      const lines = stdout.split('\n');
      // Filter out empty lines and the header "List of devices attached"
      const devices = lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('List of devices'));

      if (devices.length > 0) {
        logger.success(`Device connected: ${devices[0]}`);
      } else {
        logger.error('No devices found');
        process.exit(1);
      }
    } catch (error) {
      logger.error('Failed to run adb devices');
      if (error instanceof Error) {
        logger.error(error.message);
      }
      process.exit(1);
    }
  });
