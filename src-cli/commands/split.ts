import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ALL_EXTENSIONS } from '../utils/constants.js';
import { inspectMediaDates } from '../utils/dates.js';
import { sha256File } from '../utils/hash.js';
import { createCliOutput, type CliOutput } from '../utils/logger.js';

interface SplitFile {
  readonly name: string;
  /** Path relative to the source root (preserves nested folder structure on move). */
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly size: number;
}

const MEDIA_EXTENSIONS = new Set(
  ALL_EXTENSIONS.map((ext) => ext.toLowerCase()),
);

interface SplitBatch {
  readonly files: SplitFile[];
  readonly totalSize: number;
}

const splitOptionsSchema = z
  .object({
    count: z.coerce.number().int().positive().optional(),
    date: z.boolean().optional(),
    hash: z.boolean().optional(),
    jsonl: z.boolean().optional(),
    recursive: z.boolean().optional(),
    size: z.string().optional(),
  })
  .refine((options) => {
    if (options.recursive) {
      return (
        Boolean(options.date) &&
        !options.hash &&
        !options.count &&
        !options.size
      );
    }
    return true;
  }, {
    message: '--recursive requires --date without --hash, --count, or --size.',
  })
  .refine((options) => {
    const hasCount = Boolean(options.count);
    const hasSize = Boolean(options.size);
    const hasDate = Boolean(options.date);
    const hasHash = Boolean(options.hash);

    if (hasDate && hasHash) {
      return !hasCount && !hasSize;
    }

    const selectedModes = [hasCount, hasSize, hasDate, hasHash].filter(Boolean);
    return selectedModes.length === 1;
  }, {
    message:
      'Choose --count, --size, --date, --hash, or --date with --hash together.',
  });

type SplitOptions = z.infer<typeof splitOptionsSchema>;

const SIZE_PATTERN = /^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib|gb|gib|tb|tib)?$/i;

function parseSizeLimit(value: string): number {
  const match = value.trim().match(SIZE_PATTERN);
  if (!match) {
    throw new Error('Invalid --size value. Use values like 500mb, 4gb, or 10gb.');
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  const multiplier =
    {
      b: 1,
      kb: 1000,
      kib: 1024,
      mb: 1000 ** 2,
      mib: 1024 ** 2,
      gb: 1000 ** 3,
      gib: 1024 ** 3,
      tb: 1000 ** 4,
      tib: 1024 ** 4,
    }[unit] ?? 1;

  const bytes = Math.floor(amount * multiplier);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('Invalid --size value. Size must be greater than zero.');
  }
  return bytes;
}

function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

async function collectFiles(sourceDir: string): Promise<SplitFile[]> {
  const files: SplitFile[] = [];

  async function walk(dir: string, relativeDir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const relativePath = relativeDir
        ? path.join(relativeDir, entry.name)
        : entry.name;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (!MEDIA_EXTENSIONS.has(ext)) continue;

      const stat = await fs.stat(fullPath);
      files.push({
        name: entry.name,
        relativePath,
        sourcePath: fullPath,
        size: stat.size,
      });
    }
  }

  await walk(sourceDir, '');
  return files.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }),
  );
}

type SplitDestinationLayout = 'flat' | 'preserve';

function destinationPathFor(
  file: SplitFile,
  destinationDir: string,
  layout: SplitDestinationLayout = 'preserve',
): string {
  const relativeName = layout === 'flat' ? file.name : file.relativePath;
  return path.join(destinationDir, relativeName);
}

function batchByCount(files: SplitFile[], count: number): SplitBatch[] {
  const batches: SplitBatch[] = [];
  for (let i = 0; i < files.length; i += count) {
    const batchFiles = files.slice(i, i + count);
    batches.push({
      files: batchFiles,
      totalSize: batchFiles.reduce((total, file) => total + file.size, 0),
    });
  }
  return batches;
}

function batchBySize(files: SplitFile[], sizeLimit: number): SplitBatch[] {
  const batches: SplitBatch[] = [];
  let currentFiles: SplitFile[] = [];
  let currentSize = 0;

  for (const file of files) {
    const wouldExceedLimit =
      currentFiles.length > 0 && currentSize + file.size > sizeLimit;
    if (wouldExceedLimit) {
      batches.push({ files: currentFiles, totalSize: currentSize });
      currentFiles = [];
      currentSize = 0;
    }

    currentFiles.push(file);
    currentSize += file.size;
  }

  if (currentFiles.length > 0) {
    batches.push({ files: currentFiles, totalSize: currentSize });
  }

  return batches;
}

function formatMonthLabel(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function dateLabelForFile(file: SplitFile): Promise<string> {
  try {
    const inspected = await inspectMediaDates(file.sourcePath);
    const suggested = inspected.candidates.find(
      (candidate) => candidate.id === inspected.suggestedCandidateId,
    );
    const fallback = inspected.candidates.find(
      (candidate) => candidate.unixSeconds !== null,
    );
    const unixSeconds = suggested?.unixSeconds ?? fallback?.unixSeconds;
    if (unixSeconds !== undefined && unixSeconds !== null) {
      return formatMonthLabel(unixSeconds);
    }
  } catch {
    // Keep date splitting read-only and best-effort: unreadable metadata falls back.
  }

  return 'Unknown Date';
}

async function moveBatch(
  batch: SplitBatch,
  batchDir: string,
  output: CliOutput,
): Promise<{ failed: number; moved: number }> {
  let moved = 0;
  let failed = 0;

  await fs.mkdir(batchDir, { recursive: true });

  for (const file of batch.files) {
    const destinationPath = destinationPathFor(file, batchDir);
    try {
      if (path.resolve(file.sourcePath) === path.resolve(destinationPath)) {
        moved++;
        continue;
      }

      try {
        await fs.access(destinationPath);
        output.warn(`Skipped · ${file.relativePath} · destination exists`);
        failed++;
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rename(file.sourcePath, destinationPath);
      moved++;
      output.muted(`Moved · ${file.relativePath}`);
    } catch (error) {
      failed++;
      output.warn(`Failed · ${file.relativePath}`);
    }
  }

  return { failed, moved };
}

type MoveFileResult = 'failed' | 'moved' | 'skipped';

async function moveFile(
  file: SplitFile,
  destinationDir: string,
  output: CliOutput,
  layout: SplitDestinationLayout = 'preserve',
): Promise<MoveFileResult> {
  await fs.mkdir(destinationDir, { recursive: true });

  const destinationPath = destinationPathFor(file, destinationDir, layout);
  try {
    if (path.resolve(file.sourcePath) === path.resolve(destinationPath)) {
      return 'moved';
    }

    try {
      await fs.access(destinationPath);
      if (layout === 'flat') {
        output.muted(`Skipped · ${file.relativePath} · duplicate`);
        return 'skipped';
      }
      output.warn(`Skipped · ${file.relativePath} · destination exists`);
      return 'failed';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (layout === 'preserve') {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    }
    await fs.rename(file.sourcePath, destinationPath);
    output.muted(
      `Moved · ${file.relativePath} · ${path.basename(destinationDir)}`,
    );
    return 'moved';
  } catch {
    output.warn(`Failed · ${file.relativePath}`);
    return 'failed';
  }
}

function applyMoveResult(
  result: MoveFileResult,
  counts: { failed: number; moved: number },
): void {
  if (result === 'moved' || result === 'skipped') {
    counts.moved++;
  } else {
    counts.failed++;
  }
}

async function hashLabelForFile(
  file: SplitFile,
  output: CliOutput,
): Promise<string | null> {
  try {
    return await sha256File(file.sourcePath);
  } catch {
    output.warn(`Skipped · ${file.relativePath} · could not hash file`);
    return null;
  }
}

async function splitByHash(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
): Promise<{ failed: number; moved: number }> {
  const counts = { moved: 0, failed: 0 };

  for (const file of files) {
    const label = await hashLabelForFile(file, output);
    if (label === null) {
      counts.failed++;
      output.event({
        v: 1,
        kind: 'progress',
        done: counts.moved,
        total: files.length,
      });
      continue;
    }

    const result = await moveFile(
      file,
      path.join(outputDir, label),
      output,
      'flat',
    );
    applyMoveResult(result, counts);
    output.event({
      v: 1,
      kind: 'progress',
      done: counts.moved,
      total: files.length,
    });
  }

  return counts;
}

async function splitByDateAndHash(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
): Promise<{ failed: number; moved: number }> {
  const counts = { moved: 0, failed: 0 };

  for (const file of files) {
    const hashLabel = await hashLabelForFile(file, output);
    if (hashLabel === null) {
      counts.failed++;
      output.event({
        v: 1,
        kind: 'progress',
        done: counts.moved,
        total: files.length,
      });
      continue;
    }

    const dateLabel = await dateLabelForFile(file);
    const result = await moveFile(
      file,
      path.join(outputDir, dateLabel, hashLabel),
      output,
      'flat',
    );
    applyMoveResult(result, counts);
    output.event({
      v: 1,
      kind: 'progress',
      done: counts.moved,
      total: files.length,
    });
  }

  return counts;
}

async function splitByDate(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
  layout: SplitDestinationLayout = 'preserve',
): Promise<{ failed: number; moved: number }> {
  const counts = { moved: 0, failed: 0 };

  for (const file of files) {
    const label = await dateLabelForFile(file);
    const result = await moveFile(
      file,
      path.join(outputDir, label),
      output,
      layout,
    );
    applyMoveResult(result, counts);
    output.event({
      v: 1,
      kind: 'progress',
      done: counts.moved,
      total: files.length,
    });
  }

  return counts;
}

export const split = new Command()
  .name('split')
  .description(
    'recursively move media files from a folder into batch subfolders in that same folder',
  )
  .argument('<folder>', 'the folder to split into batches')
  .option(
    '--count <files>',
    'maximum number of files per batch folder, e.g. --count 1000',
  )
  .option(
    '--size <bytes>',
    'maximum total size per batch folder, e.g. --size 4gb',
  )
  .option(
    '--date',
    'move files into month folders (YYYY-MM) from media date metadata; combine with --hash for date/hash nesting',
  )
  .option(
    '--hash',
    'move files into SHA-256 hash folders (flat files inside); combine with --date for YYYY-MM/hash layout',
  )
  .option(
    '--recursive',
    'with --date, pull nested files (e.g. from prior hash splits) into flat YYYY-MM folders',
  )
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(async (initialFolder: string, rawOptions: SplitOptions) => {
    const output = createCliOutput(Boolean(rawOptions.jsonl));

    try {
      const options = splitOptionsSchema.parse(rawOptions);
      const sourceDir = path.resolve(initialFolder);
      const stat = await fs.stat(sourceDir);
      if (!stat.isDirectory()) {
        output.error('Source must be a directory.', 'not_directory');
        process.exit(1);
      }

      const files = await collectFiles(sourceDir);
      if (files.length === 0) {
        output.error('No media files found to split.', 'no_files');
        process.exit(1);
      }

      const outputDir = sourceDir;

      output.event({
        v: 1,
        kind: 'session',
        phase: 'start',
        command: 'split',
        layout: 'directory',
        outputDir,
        total: files.length,
      });

      if (!output.jsonl) {
        output.blankLine();
        output.info('Folder');
        output.indentedMuted(sourceDir);
        output.info('Mode');
        output.indentedMuted(
          options.count
            ? `Move into folders of up to ${options.count} file(s)`
            : options.size
            ? `Move into folders of up to ${options.size}`
            : options.date && options.hash
            ? 'Move into YYYY-MM folders, then SHA-256 hash subfolders'
            : options.hash
            ? 'Move into folders by SHA-256 content hash'
            : options.date && options.recursive
            ? 'Move into flat YYYY-MM folders (from nested sources)'
            : 'Move into folders by month from available date metadata',
        );
      }

      let moved = 0;
      let failed = 0;

      if (options.date && options.hash) {
        if (!output.jsonl) {
          output.blankLine();
          output.info('Moves');
        }
        const result = await splitByDateAndHash(files, outputDir, output);
        moved = result.moved;
        failed = result.failed;
      } else if (options.date) {
        if (!output.jsonl) {
          output.blankLine();
          output.info('Moves');
        }
        const result = await splitByDate(
          files,
          outputDir,
          output,
          options.recursive ? 'flat' : 'preserve',
        );
        moved = result.moved;
        failed = result.failed;
      } else if (options.hash) {
        if (!output.jsonl) {
          output.blankLine();
          output.info('Moves');
        }
        const result = await splitByHash(files, outputDir, output);
        moved = result.moved;
        failed = result.failed;
      } else {
        const batches = options.count
          ? batchByCount(files, options.count)
          : batchBySize(files, parseSizeLimit(options.size!));

        if (!output.jsonl) {
          output.blankLine();
          output.info('Batches');
          for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            output.indentedMuted(
              `Part ${i + 1}: ${batch.files.length} file(s), ${formatBytes(
                batch.totalSize,
              )}`,
            );
          }
          output.blankLine();
        }

        for (let i = 0; i < batches.length; i++) {
          const batchDir = path.join(
            outputDir,
            `Part ${String(i + 1).padStart(String(batches.length).length, '0')}`,
          );
          const result = await moveBatch(batches[i], batchDir, output);
          moved += result.moved;
          failed += result.failed;
          output.event({
            v: 1,
            kind: 'progress',
            done: moved,
            total: files.length,
          });
        }
      }

      output.event({
        v: 1,
        kind: 'session',
        phase: 'end',
        command: 'split',
        layout: 'directory',
        outputDir,
        total: files.length,
        processed: moved,
        failed,
      });

      output.blankLine();
      output.success(`Done · ${moved} moved, ${failed} failed`);
      if (!output.jsonl) output.indentedMuted(outputDir);
    } catch (error) {
      if (error instanceof z.ZodError) {
        output.error(error.issues[0]?.message ?? 'Invalid split options.');
      } else {
        output.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });
