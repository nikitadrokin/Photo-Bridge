import { Command } from 'commander';
import { execa } from 'execa';
import type { PixelFilePayload } from '../../types/protocol.js';
import { createCliOutput } from '../utils/logger.js';

/** Default Pixel camera roll path (mirrors PIXEL_CAMERA_DIR in the UI). */
const PIXEL_CAMERA_DIR = '/sdcard/DCIM/Camera';

/**
 * Parses one `adb shell ls -la` row (toybox format) into a file payload.
 * Expected columns: mode links user group size YYYY-MM-DD HH:MM name.
 * Returns null for directories, totals, and unparseable lines.
 */
function parseLsLine(line: string, dir: string): PixelFilePayload | null {
  const match =
    /^([-dlbcps])([rwxsStT-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/.exec(
      line.trim(),
    );
  if (!match) return null;
  const [, typeChar, , sizeRaw, date, time, name] = match;
  if (typeChar !== '-') return null;
  if (name === '.' || name === '..') return null;

  const parsedMtime = Date.parse(`${date}T${time}:00Z`);
  return {
    name,
    path: `${dir}/${name}`,
    sizeBytes: Number(sizeRaw),
    mtimeUnix: Number.isNaN(parsedMtime) ? null : Math.floor(parsedMtime / 1000),
  };
}

const listCmd = new Command('list')
  .description('list media files on the connected Pixel camera roll')
  .option('--jsonl', 'emit the listing as a JSONL UI event on stdout')
  .option('--dir <path>', 'device directory to list', PIXEL_CAMERA_DIR)
  .action(async (opts: { jsonl?: boolean; dir: string }) => {
    const output = createCliOutput(Boolean(opts.jsonl));
    const dir = opts.dir;

    const result = await execa('adb', ['shell', 'ls', '-la', dir], {
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'pipe',
      reject: false,
    });

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
      .map((line) => parseLsLine(line, dir))
      .filter((file): file is PixelFilePayload => file !== null)
      .sort((a, b) => (b.mtimeUnix ?? 0) - (a.mtimeUnix ?? 0));

    if (opts.jsonl) {
      output.event({ v: 1, kind: 'pixel_list', dir, files });
      return;
    }

    for (const file of files) {
      output.log(`${file.name}\t${String(file.sizeBytes)}`);
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
      'adb',
      ['shell', 'find', dir, '-maxdepth', '1', '-type', 'f', '|', 'wc', '-l'],
      { stdin: 'ignore', stdout: 'pipe', stderr: 'pipe', reject: false },
    );
    const deleted = Number.parseInt((countResult.stdout ?? '').trim(), 10);

    const rmResult = await execa(
      'adb',
      ['shell', `rm -f ${dir}/*`],
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

export const pixel = new Command('pixel')
  .description('inspect and manage the connected Pixel camera roll')
  .addCommand(listCmd)
  .addCommand(purgeCmd);
