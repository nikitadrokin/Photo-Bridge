import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { ALL_EXTENSIONS } from '../utils/constants.js';
import {
  inspectMediaDates,
  pickInspectUnixSeconds,
  type MediaDateInspectResult,
} from '../utils/dates.js';
import { createCliOutput, type CliOutput } from '../utils/logger.js';

const MEDIA_EXTENSIONS = new Set(
  ALL_EXTENSIONS.map((ext) => ext.toLowerCase()),
);

/** One media file included in a gallery scan. */
export interface GalleryScanFile {
  readonly path: string;
  readonly basename: string;
  readonly mediaKind: MediaDateInspectResult['mediaKind'];
  readonly unixSeconds: number | null;
}

/** Files grouped under a UTC calendar day (`YYYY-MM-DD`) or `unknown`. */
export interface GalleryScanDay {
  readonly dayKey: string;
  readonly files: readonly GalleryScanFile[];
}

/** Payload emitted as the final `gallery_scan` JSONL event or stdout JSON. */
export interface GalleryScanResult {
  readonly root: string;
  readonly totalFiles: number;
  readonly days: readonly GalleryScanDay[];
}

async function collectMediaFilesRecursive(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase().slice(1);
        if (MEDIA_EXTENSIONS.has(ext)) {
          files.push(full);
        }
      }
    }
  }

  await walk(dirPath);
  return files.sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true }),
  );
}

function dayKeyFromUnix(unixSeconds: number | null): string {
  if (unixSeconds === null) {
    return 'unknown';
  }
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function groupFilesByDay(files: GalleryScanFile[]): GalleryScanDay[] {
  const byDay = new Map<string, GalleryScanFile[]>();

  for (const file of files) {
    const key = dayKeyFromUnix(file.unixSeconds);
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(file);
    } else {
      byDay.set(key, [file]);
    }
  }

  const days: GalleryScanDay[] = [];
  for (const [dayKey, dayFiles] of byDay) {
    dayFiles.sort((a, b) => {
      if (a.unixSeconds !== null && b.unixSeconds !== null) {
        if (a.unixSeconds !== b.unixSeconds) {
          return a.unixSeconds - b.unixSeconds;
        }
      } else if (a.unixSeconds !== null) {
        return -1;
      } else if (b.unixSeconds !== null) {
        return 1;
      }
      return a.basename.localeCompare(b.basename, undefined, {
        numeric: true,
      });
    });
    days.push({ dayKey, files: dayFiles });
  }

  days.sort((a, b) => {
    if (a.dayKey === 'unknown') return 1;
    if (b.dayKey === 'unknown') return -1;
    return b.dayKey.localeCompare(a.dayKey);
  });

  return days;
}

async function scanGalleryDirectory(
  rootDir: string,
  output: CliOutput,
  jsonl: boolean,
): Promise<GalleryScanResult> {
  const paths = await collectMediaFilesRecursive(rootDir);
  const scanned: GalleryScanFile[] = [];

  if (jsonl) {
    output.event({
      v: 1,
      kind: 'session',
      phase: 'start',
      command: 'gallery',
      layout: 'directory',
      outputDir: rootDir,
      total: paths.length,
    });
  }

  for (let i = 0; i < paths.length; i += 1) {
    const filePath = paths[i];
    const basename = path.basename(filePath);
    let mediaKind: GalleryScanFile['mediaKind'] = 'unknown';
    let unixSeconds: number | null = null;

    try {
      const inspected = await inspectMediaDates(filePath);
      mediaKind = inspected.mediaKind;
      unixSeconds = pickInspectUnixSeconds(inspected);
    } catch {
      unixSeconds = null;
    }

    scanned.push({
      path: filePath,
      basename,
      mediaKind,
      unixSeconds,
    });

    if (jsonl) {
      output.event({
        v: 1,
        kind: 'progress',
        done: i + 1,
        total: paths.length,
      });
    }
  }

  const result: GalleryScanResult = {
    root: rootDir,
    totalFiles: scanned.length,
    days: groupFilesByDay(scanned),
  };

  if (jsonl) {
    output.event({
      v: 1,
      kind: 'gallery_scan',
      root: result.root,
      totalFiles: result.totalFiles,
      days: result.days,
    });
    output.event({
      v: 1,
      kind: 'session',
      phase: 'end',
      command: 'gallery',
      layout: 'directory',
      outputDir: rootDir,
      total: paths.length,
      processed: paths.length,
      failed: 0,
    });
  } else {
    process.stdout.write(`${JSON.stringify(result)}\n`);
  }

  return result;
}

const scanCmd = new Command('scan')
  .description(
    'scan a folder recursively and group media by UTC day from embedded dates',
  )
  .argument('<folder>', 'root folder to scan (e.g. a month folder)')
  .option('--jsonl', 'emit progress and result as JSONL UI events on stdout')
  .action(async (folder: string, opts: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(opts.jsonl));

    try {
      const rootDir = path.resolve(folder);
      const stat = await fs.stat(rootDir);
      if (!stat.isDirectory()) {
        output.error('Source must be a directory.', 'not_directory');
        process.exit(1);
      }

      await scanGalleryDirectory(rootDir, output, Boolean(opts.jsonl));
    } catch (error) {
      output.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

export const gallery = new Command('gallery')
  .description('read-only gallery helpers for the desktop UI')
  .addCommand(scanCmd);
