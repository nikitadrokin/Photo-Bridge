import { Command } from 'commander';
import { execa } from 'execa';
import { createCliOutput } from '../utils/logger.js';

export const checkAdb = new Command()
  .name('check-adb')
  .description('Check if an ADB device is connected')
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(async (options: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(options.jsonl));

    try {
      const { stdout } = await execa('adb', ['devices']);
      const lines = stdout.split('\n');
      // Filter out empty lines and the header "List of devices attached"
      const devices = lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('List of devices'));

      if (devices.length > 0) {
        output.success(`Device connected: ${devices[0]}`);
      } else {
        output.error('No devices found', 'no_adb_devices');
        process.exit(1);
      }
    } catch (error) {
      output.error('Failed to run adb devices', 'adb_devices_failed');
      if (error instanceof Error) {
        output.error(error.message, 'adb_devices_error');
      }
      process.exit(1);
    }
  });
