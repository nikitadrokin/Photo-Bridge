import { Command } from 'commander';
import * as Fs from 'fs';
import * as Path from 'path';
import { Adb } from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .alias('push')
  .description('Push directory to Pixel Camera folder')
  .argument('<directory>', 'directory to push')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (directory: string, opts) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    const client = Adb.createClient();

    try {
      // Get connected devices
      const devices = await client.listDevices();
      if (devices.length === 0) {
        logger.error('No devices connected');
        return;
      }

      // Use first connected device
      const device = devices[0];
      logger.info(`Using device: ${device.id}`);

      // Create sync service for efficient file operations
      const sync = await client.getDevice(device.id).syncService();

      try {
        await pushDirectory(sync, directory, '/sdcard/DCIM/Camera');
        logger.success('Directory push completed');
      } finally {
        sync.end();
      }
    } catch (error) {
      logger.error(
        `Failed to push directory: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });

async function pushDirectory(sync: any, sourceDir: string, targetDir: string) {
  const files = await readDirectoryRecursively(sourceDir);
  let totalFiles = files.length;
  let completedFiles = 0;

  for (const file of files) {
    const relativePath = Path.relative(sourceDir, file);
    const targetPath = Path.join(targetDir, relativePath);

    logger.info(`Pushing: ${relativePath}`);

    try {
      const transfer = sync.pushFile(file, targetPath);

      // Track progress for each file
      transfer.on('progress', (stats: any) => {
        const progressData = {
          type: 'progress',
          file: relativePath,
          bytesTransferred: stats.bytesTransferred,
          completedFiles,
          totalFiles,
        };
        logger.log(JSON.stringify(progressData));
      });

      transfer.on('error', (err: Error) => {
        const errorData = {
          type: 'error',
          file: relativePath,
          error: err.message,
        };
        logger.error(JSON.stringify(errorData));
      });

      transfer.on('end', () => {
        completedFiles++;
        const completeData = {
          type: 'file_complete',
          file: relativePath,
          completedFiles,
          totalFiles,
        };
        logger.log(JSON.stringify(completeData));
      });

      await new Promise((resolve, reject) => {
        transfer.on('end', resolve);
        transfer.on('error', reject);
      });
    } catch (error) {
      logger.error(
        `Failed to push ${relativePath}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }
}

async function readDirectoryRecursively(dir: string): Promise<string[]> {
  const files: string[] = [];

  async function traverse(currentDir: string) {
    const entries = await Fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = Path.join(currentDir, entry.name);

      if (entry.isFile()) {
        files.push(fullPath);
      } else if (entry.isDirectory()) {
        await traverse(fullPath);
      }
    }
  }

  await traverse(dir);
  return files;
}
