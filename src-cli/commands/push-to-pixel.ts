import { Command } from 'commander';
import * as Fs from 'fs';
import * as Job from 'path';
import { Adb } from '@devicefarmer/adbkit';
import type DeviceClient from '@devicefarmer/adbkit/dist/src/adb/DeviceClient';
import { logger } from '../utils/logger.js';

/** Resolved ADB sync service from adbkit (Bluebird-promise–based API). */
type AdbSyncSession = Awaited<ReturnType<DeviceClient['syncService']>>;

/** One local file to push and its path under the device target directory. */
interface Job {
  /** Absolute path on the host filesystem */
  absolutePath: string;
  /** Path relative to `targetDir` on the device (uses subdirs for folder pushes) */
  relativePath: string;
}

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .alias('push')
  .description('Push files or directories to the Pixel Camera folder')
  .argument('<paths...>', 'one or more files or directories to push')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: Array<string>, opts: { jsonl?: boolean }) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    if (paths.length === 0) {
      logger.error('No paths provided');
      return;
    }

    const client = Adb.createClient();

    try {
      const devices = await client.listDevices();
      if (devices.length === 0) {
        logger.error('No devices connected');
        return;
      }

      const device = devices[0];
      logger.info(`Using device: ${device.id}`);

      const jobs = await collectPushJobs(paths);
      if (jobs.length === 0) {
        logger.error('No files to push');
        return;
      }

      const sync: AdbSyncSession = await client
        .getDevice(device.id)
        .syncService();

      try {
        await pushJobs(sync, jobs, '/sdcard/DCIM/Camera');
        logger.success('Push completed');
      } finally {
        sync.end();
      }
    } catch (error) {
      logger.error(
        `Failed to push: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });

async function collectPushJobs(paths: Array<string>): Promise<Array<Job>> {
  const jobs: Array<Job> = [];

  for (const inputPath of paths) {
    let st: Fs.Stats;
    try {
      st = await Fs.promises.stat(inputPath);
    } catch {
      logger.error(`Path not found: ${inputPath}`);
      continue;
    }

    if (st.isFile()) {
      jobs.push({
        absolutePath: inputPath,
        relativePath: Job.basename(inputPath),
      });
    } else if (st.isDirectory()) {
      const files = await readDirectoryRecursively(inputPath);
      for (const file of files) {
        jobs.push({
          absolutePath: file,
          relativePath: Job.relative(inputPath, file),
        });
      }
    } else {
      logger.error(`Not a file or directory: ${inputPath}`);
    }
  }

  return jobs;
}

async function pushJobs(
  sync: AdbSyncSession,
  jobs: Array<Job>,
  targetDir: string,
): Promise<void> {
  let totalFiles = jobs.length;
  let completedFiles = 0;
  const isJson = logger.getMode() === 'json';

  for (const job of jobs) {
    const { absolutePath: localPath, relativePath: relativePath } = job;
    const targetPath = Job.join(targetDir, relativePath);

    logger.info(`Pushing: ${relativePath}`);

    try {
      const transfer = sync.pushFile(localPath, targetPath);

      transfer.on('progress', (stats: { bytesTransferred: number }) => {
        if (!isJson) {
          return;
        }
        logger.emitJSON({
          v: 1,
          kind: 'push_bytes',
          file: relativePath,
          bytesTransferred: stats.bytesTransferred,
          completedFiles,
          totalFiles,
        });
      });

      transfer.on('error', (err: Error) => {
        if (isJson) {
          logger.emitJSON({
            v: 1,
            kind: 'error',
            code: 'push_transfer_failed',
            detail: `${relativePath}: ${err.message}`,
          });
        } else {
          logger.error(`Push failed (${relativePath}): ${err.message}`);
        }
      });

      transfer.on('end', () => {
        completedFiles++;
        if (isJson) {
          logger.emitJSON({
            v: 1,
            kind: 'progress',
            done: completedFiles,
            total: totalFiles,
          });
        }
      });

      await new Promise<void>((resolve, reject) => {
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

async function readDirectoryRecursively(dir: string): Promise<Array<string>> {
  const files: Array<string> = [];

  async function traverse(currentDir: string): Promise<void> {
    const entries = await Fs.promises.readdir(currentDir, {
      withFileTypes: true,
    });

    for (const entry of entries) {
      const fullPath = Job.join(currentDir, entry.name);

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
