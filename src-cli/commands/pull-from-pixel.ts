import { promises as fs } from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Command } from 'commander';
import { Adb } from '@devicefarmer/adbkit';
import { resolveTool } from '../utils/tool-paths';
import { createCliOutput } from '../utils/logger.js';
import type { EventV1 } from '../../types/protocol.js';

const REMOTE_CAMERA = '/sdcard/DCIM/Camera';

async function listRemoteFiles(sync: any, remoteDir: string): Promise<Array<string>> {
  const files: Array<string> = [];

  async function walk(dir: string): Promise<void> {
    const entries = await sync.readdir(dir);
    for (const entry of entries) {
      const fullRemote = path.posix.join(dir, entry.name);
      if (entry.isDirectory()) await walk(fullRemote);
      else if (entry.isFile()) files.push(fullRemote);
    }
  }

  await walk(remoteDir);
  return files;
}

async function pullFiles(
  sync: any,
  remoteBase: string,
  destDir: string,
  isJsonl: boolean,
  onEvent: (event: EventV1) => void,
): Promise<void> {
  const remoteFiles = await listRemoteFiles(sync, remoteBase);
  const totalFiles = remoteFiles.length;
  let completedFiles = 0;

  for (const remotePath of remoteFiles) {
    const relativePath = path.posix.relative(remoteBase, remotePath);
    const localPath = path.join(destDir, ...relativePath.split('/'));

    try {
      await fs.mkdir(path.dirname(localPath), { recursive: true });

      const transfer = sync.pull(remotePath);

      if (isJsonl) {
        transfer.on('progress', (stats: { bytesTransferred: number }) => {
          onEvent({
            v: 1,
            kind: 'pull_bytes',
            file: relativePath,
            bytesTransferred: stats.bytesTransferred,
            completedFiles,
            totalFiles,
          });
        });
      }

      await pipeline(transfer, createWriteStream(localPath));

      completedFiles++;
      if (isJsonl) {
        onEvent({ v: 1, kind: 'progress', done: completedFiles, total: totalFiles });
      }
    } catch (err) {
      const detail = `${relativePath}: ${err instanceof Error ? err.message : String(err)}`;
      onEvent({ v: 1, kind: 'error', code: 'pull_transfer_failed', detail });
    }
  }
}

export const pullFromPixel = new Command()
  .name('pull-from-pixel')
  .alias('pull')
  .description('Pull files from Pixel Camera folder')
  .argument('[destination]', 'destination directory', '.')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (destination: string, opts: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(opts.jsonl));
    const destDir = path.resolve(destination);

    output.info(`Pulling from device to: ${destDir}`);

    const client = Adb.createClient({ bin: resolveTool('adb') });

    try {
      const devices = await client.listDevices();
      if (devices.length === 0) {
        output.error('No devices connected', 'no_devices');
        process.exit(1);
      }

      const device = devices[0];
      output.info(`Using device: ${device.id}`);

      const sync = await client.getDevice(device.id).syncService();

      try {
        await pullFiles(
          sync,
          REMOTE_CAMERA,
          destDir,
          Boolean(opts.jsonl),
          (event) => output.event(event),
        );
        output.success('Pull complete');
      } finally {
        sync.end();
      }
    } catch (err) {
      output.error(
        `Pull failed: ${err instanceof Error ? err.message : String(err)}`,
        'pull_failed',
      );
      process.exit(1);
    }
  });
