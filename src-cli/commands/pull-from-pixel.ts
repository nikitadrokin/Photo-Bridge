import { Command } from 'commander';
import * as Fs from 'fs';
import * as Path from 'path';
import { pipeline } from 'stream/promises';
import { Adb } from '@devicefarmer/adbkit';
import { logger } from '../utils/logger.js';

const REMOTE_CAMERA = '/sdcard/DCIM/Camera';

export const pullFromPixel = new Command()
  .name('pull-from-pixel')
  .alias('pull')
  .description('Pull files from Pixel Camera folder')
  .argument('[destination]', 'destination directory', '.')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (destination: string, opts) => {
    if (opts.jsonl) {
      logger.setMode('json');
    }

    const destDir = Path.resolve(destination);
    logger.info(`Pulling from device to: ${destDir}`);

    const client = Adb.createClient();

    try {
      const devices = await client.listDevices();
      if (devices.length === 0) {
        logger.error('No devices connected');
        return;
      }

      const device = devices[0];
      logger.info(`Using device: ${device.id}`);

      const sync = await client.getDevice(device.id).syncService();

      try {
        await pullDirectory(sync, REMOTE_CAMERA, destDir);
        logger.success('Pull complete');
      } finally {
        sync.end();
      }
    } catch (error) {
      logger.error(
        `Failed to pull from device: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  });

/** Lists regular files under `remoteDir` (POSIX paths). */
async function listRemoteFiles(sync: any, remoteDir: string): Promise<Array<string>> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await sync.readdir(dir);
    for (const entry of entries) {
      const name = entry.name;
      const fullRemote = Path.posix.join(dir, name);
      if (entry.isDirectory()) {
        await walk(fullRemote);
      } else if (entry.isFile()) {
        files.push(fullRemote);
      }
    }
  }

  await walk(remoteDir);
  return files;
}

async function pullDirectory(sync: any, remoteBase: string, destDir: string): Promise<void> {
  const remoteFiles = await listRemoteFiles(sync, remoteBase);
  const totalFiles = remoteFiles.length;
  let completedFiles = 0;
  const isJson = logger.getMode() === 'json';

  for (const remotePath of remoteFiles) {
    const relativePath = Path.posix.relative(remoteBase, remotePath);
    const localPath = Path.join(destDir, ...relativePath.split('/'));

    logger.info(`Pulling: ${relativePath}`);

    await Fs.promises.mkdir(Path.dirname(localPath), { recursive: true });

    try {
      const transfer = sync.pull(remotePath);

      transfer.on('progress', (stats: { bytesTransferred: number }) => {
        if (!isJson) {
          return;
        }
        logger.emitJSON({
          v: 1,
          kind: 'pull_bytes',
          file: relativePath,
          bytesTransferred: stats.bytesTransferred,
          completedFiles,
          totalFiles,
        });
      });

      await pipeline(transfer, Fs.createWriteStream(localPath));

      completedFiles++;
      if (isJson) {
        logger.emitJSON({
          v: 1,
          kind: 'progress',
          done: completedFiles,
          total: totalFiles,
        });
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      if (isJson) {
        logger.emitJSON({
          v: 1,
          kind: 'error',
          code: 'pull_transfer_failed',
          detail: `${relativePath}: ${message}`,
        });
      } else {
        logger.error(`Failed to pull ${relativePath}: ${message}`);
      }
    }
  }
}
