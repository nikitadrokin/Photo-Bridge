import path from 'node:path';
import { createWriteStream } from 'node:fs';
import { promises as fs } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Command } from 'commander';
import { execa } from 'execa';
import { resolveTool } from '../utils/tool-paths';
import { Adb } from '@devicefarmer/adbkit';
import type { EventV1, PixelFilePayload } from '../../types/protocol.js';
import { createCliOutput } from '../utils/logger.js';

/** Default Pixel camera roll path (mirrors PIXEL_CAMERA_DIR in the UI). */
const PIXEL_CAMERA_DIR = '/sdcard/DCIM/Camera';

/**
 * Single-quotes a string for the device shell that `adb shell` re-parses.
 * Wraps in single quotes and escapes embedded single quotes via `'\''`.
 */
function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Parses one `stat -c '%s|%Y|%n'` row into a file payload, relative to `dir`.
 * `%n` (the path) can itself contain `|`, so we split on the first two only.
 */
function parseStatLine(line: string, dir: string): PixelFilePayload | null {
  const trimmed = line.replace(/\r$/, '').trim();
  if (trimmed.length === 0) return null;

  const firstBar = trimmed.indexOf('|');
  const secondBar = trimmed.indexOf('|', firstBar + 1);
  if (firstBar === -1 || secondBar === -1) return null;

  const sizeRaw = trimmed.slice(0, firstBar);
  const mtimeRaw = trimmed.slice(firstBar + 1, secondBar);
  const fullPath = trimmed.slice(secondBar + 1);
  if (fullPath.length === 0) return null;

  const sizeBytes = Number(sizeRaw);
  const mtime = Number(mtimeRaw);

  return {
    name: path.posix.basename(fullPath),
    path: fullPath,
    relativePath: path.posix.relative(dir, fullPath),
    sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : 0,
    mtimeUnix: Number.isFinite(mtime) && mtime > 0 ? Math.floor(mtime) : null,
  };
}

const listCmd = new Command('list')
  .description('list media files on the connected Pixel camera roll (recursive)')
  .option('--jsonl', 'emit the listing as a JSONL UI event on stdout')
  .option('--dir <path>', 'device directory to list', PIXEL_CAMERA_DIR)
  .action(async (opts: { jsonl?: boolean; dir: string }) => {
    const output = createCliOutput(Boolean(opts.jsonl));
    const dir = opts.dir;

    // Recurse into subfolders (e.g. folders pushed via `push-to-pixel`) and
    // read size + mtime in a single round-trip via toybox `stat`.
    // `adb shell` joins its argv with spaces and the *device's* shell re-parses
    // the result, so the `stat` format and the dir must be quoted here or the
    // remote shell splits `%s|%Y|%n` on the pipes and `find` loses its `{}`.
    const result = await execa(
      resolveTool('adb'),
      ['shell', `find ${shellQuote(dir)} -type f -exec stat -c '%s|%Y|%n' {} +`],
      { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', reject: false },
    );

    if (result.exitCode !== 0) {
      const errText =
        result.stderr.trim().length > 0
          ? result.stderr.trim()
          : `adb shell exited with code ${String(result.exitCode)}`;
      output.error(errText, 'adb_shell_error');
      process.exit(result.exitCode ?? 1);
    }

    const files = (result.stdout ?? '')
      .split('\n')
      .map((line) => parseStatLine(line, dir))
      .filter((file): file is PixelFilePayload => file !== null)
      .sort((a, b) => (b.mtimeUnix ?? 0) - (a.mtimeUnix ?? 0));

    if (opts.jsonl) {
      output.event({ v: 1, kind: 'pixel_list', dir, files });
      return;
    }

    for (const file of files) {
      output.log(`${file.relativePath}\t${String(file.sizeBytes)}`);
    }
  });

const purgeCmd = new Command('purge')
  .description('delete ALL files in the connected Pixel camera roll')
  .option('--jsonl', 'emit the result as a JSONL UI event on stdout')
  .option('--dir <path>', 'device directory to purge', PIXEL_CAMERA_DIR)
  .action(async (opts: { jsonl?: boolean; dir: string }) => {
    const output = createCliOutput(Boolean(opts.jsonl));
    const dir = opts.dir;

    const countResult = await execa(
      resolveTool('adb'),
      ['shell', `find ${shellQuote(dir)} -maxdepth 1 -type f | wc -l`],
      { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', reject: false },
    );
    const deleted = Number.parseInt((countResult.stdout ?? '').trim(), 10);

    const rmResult = await execa(
      resolveTool('adb'),
      ['shell', `rm -f ${shellQuote(dir)}/*`],
      { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', reject: false },
    );

    if (rmResult.exitCode !== 0) {
      const errText =
        rmResult.stderr.trim().length > 0
          ? rmResult.stderr.trim()
          : `adb shell exited with code ${String(rmResult.exitCode)}`;
      output.error(errText, 'adb_shell_error');
      process.exit(rmResult.exitCode ?? 1);
    }

    if (opts.jsonl) {
      output.event({
        v: 1,
        kind: 'pixel_purge',
        dir,
        deleted: Number.isNaN(deleted) ? 0 : deleted,
      });
      return;
    }

    output.success(
      `Purged ${Number.isNaN(deleted) ? 'all' : String(deleted)} files from ${dir}`,
    );
  });

/** Recursively collects file paths under a device directory. */
async function walkRemoteDir(sync: any, dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await sync.readdir(dir);
  for (const entry of entries) {
    const fullRemote = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkRemoteDir(sync, fullRemote)));
    else if (entry.isFile()) files.push(fullRemote);
  }
  return files;
}

/** Expands the requested device paths (files or folders) into (remote, local) jobs. */
async function collectPullJobs(
  sync: any,
  inputPaths: string[],
  destDir: string,
): Promise<Array<{ remote: string; local: string }>> {
  const jobs: Array<{ remote: string; local: string }> = [];
  for (const input of inputPaths) {
    const stat = await sync.stat(input);
    // Anchor relative paths at the parent so a pulled folder keeps its own name
    // and a pulled file lands directly in the destination.
    const base = path.posix.dirname(input);
    const remoteFiles = stat.isDirectory()
      ? await walkRemoteDir(sync, input)
      : [input];
    for (const remote of remoteFiles) {
      const relative = path.posix.relative(base, remote);
      jobs.push({ remote, local: path.join(destDir, ...relative.split('/')) });
    }
  }
  return jobs;
}

const pullCmd = new Command('pull')
  .description('pull files or folders from the Pixel to a local destination')
  .argument('<paths...>', 'device file or folder paths to pull')
  .option('-d, --dest <dir>', 'local destination directory', '.')
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(async (paths: string[], opts: { dest: string; jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(opts.jsonl));
    const isJsonl = Boolean(opts.jsonl);
    const destDir = path.resolve(opts.dest);

    const client = Adb.createClient();
    try {
      const devices = await client.listDevices();
      if (devices.length === 0) {
        output.error('No devices connected', 'no_devices');
        process.exit(1);
      }

      const sync = await client.getDevice(devices[0].id).syncService();
      try {
        const jobs = await collectPullJobs(sync, paths, destDir);
        const totalFiles = jobs.length;
        let completedFiles = 0;

        for (const job of jobs) {
          const relativePath = path.relative(destDir, job.local);
          try {
            await fs.mkdir(path.dirname(job.local), { recursive: true });
            const transfer = sync.pull(job.remote);

            if (isJsonl) {
              transfer.on('progress', (stats: { bytesTransferred: number }) => {
                output.event({
                  v: 1,
                  kind: 'pull_bytes',
                  file: relativePath,
                  bytesTransferred: stats.bytesTransferred,
                  completedFiles,
                  totalFiles,
                } as EventV1);
              });
            }

            await pipeline(transfer, createWriteStream(job.local));
            completedFiles++;
            if (isJsonl) {
              output.event({
                v: 1,
                kind: 'progress',
                done: completedFiles,
                total: totalFiles,
              });
            }
          } catch (err) {
            const detail = `${relativePath}: ${err instanceof Error ? err.message : String(err)}`;
            output.error(detail, 'pull_transfer_failed');
          }
        }

        output.success(`Pulled ${completedFiles} of ${totalFiles} file(s)`);
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

export const pixel = new Command('pixel')
  .description('inspect and manage the connected Pixel camera roll')
  .addCommand(listCmd)
  .addCommand(pullCmd)
  .addCommand(purgeCmd);
