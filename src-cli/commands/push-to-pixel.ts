import { promises as fs } from 'fs';
import path from 'path';
import { Command } from 'commander';
import { Adb } from '@devicefarmer/adbkit';
import { adbPushFileWithPtyProgress } from '../utils/adb-pty-push.js';
import { resolveTool } from '../utils/tool-paths';
import { createCliOutput } from '../utils/logger.js';
import type { EventV1 } from '../../types/protocol.js';

const TARGET_DIR = '/sdcard/DCIM/Camera';

/** One local file to push and its path relative to the device target directory. */
interface PushJob {
  absolutePath: string;
  relativePath: string;
}

async function collectPushJobs(paths: Array<string>): Promise<Array<PushJob>> {
  const jobs: Array<PushJob> = [];

  for (const inputPath of paths) {
    let st: Awaited<ReturnType<typeof fs.stat>>;
    try {
      st = await fs.stat(inputPath);
    } catch {
      continue;
    }

    if (st.isFile()) {
      jobs.push({ absolutePath: inputPath, relativePath: path.basename(inputPath) });
    } else if (st.isDirectory()) {
      const files = await collectFilesRecursively(inputPath);
      for (const file of files) {
        jobs.push({ absolutePath: file, relativePath: path.relative(inputPath, file) });
      }
    }
  }

  return jobs;
}

async function collectFilesRecursively(dir: string): Promise<Array<string>> {
  const files: Array<string> = [];

  async function walk(current: string): Promise<void> {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isFile()) files.push(full);
      else if (entry.isDirectory()) await walk(full);
    }
  }

  await walk(dir);
  return files;
}

async function pushJobs(
  serial: string,
  jobs: Array<PushJob>,
  isJsonl: boolean,
  onEvent: (event: EventV1) => void,
): Promise<void> {
  const totalFiles = jobs.length;
  let completedFiles = 0;

  for (const { absolutePath, relativePath } of jobs) {
    const targetPath = path.posix.join(
      TARGET_DIR,
      ...relativePath.split(path.sep),
    );

    try {
      const st = await fs.stat(absolutePath);
      await adbPushFileWithPtyProgress({
        serial,
        localPath: absolutePath,
        remotePath: targetPath,
        relativePath,
        fileSizeBytes: st.size,
        completedFiles,
        totalFiles,
        onEvent: (event) => {
          if (isJsonl) onEvent(event);
        },
      });

      completedFiles++;
      if (isJsonl) {
        onEvent({
          v: 1,
          kind: 'progress',
          done: completedFiles,
          total: totalFiles,
        });
      }
    } catch (err) {
      const detail = `${relativePath}: ${err instanceof Error ? err.message : String(err)}`;
      onEvent({ v: 1, kind: 'error', code: 'push_transfer_failed', detail });
    }
  }
}

export const pushToPixel = new Command()
  .name('push-to-pixel')
  .alias('push')
  .description('Push files or directories to the Pixel Camera folder')
  .argument('<paths...>', 'one or more files or directories to push')
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: Array<string>, opts: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(opts.jsonl));

    if (paths.length === 0) {
      output.error('No paths provided', 'no_paths');
      process.exit(1);
    }

    const client = Adb.createClient({ bin: resolveTool('adb') });

    try {
      const devices = await client.listDevices();
      if (devices.length === 0) {
        output.error('No devices connected', 'no_devices');
        process.exit(1);
      }

      const device = devices[0];
      output.info(`Using device: ${device.id}`);

      const jobs = await collectPushJobs(paths);
      if (jobs.length === 0) {
        output.error('No files to push', 'no_files');
        process.exit(1);
      }

      await pushJobs(device.id, jobs, Boolean(opts.jsonl), (event) =>
        output.event(event),
      );
      output.success('Push completed');
    } catch (err) {
      output.error(
        `Push failed: ${err instanceof Error ? err.message : String(err)}`,
        'push_failed',
      );
      process.exit(1);
    }
  });
