import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { inspectMediaDates } from '../utils/dates.js';
import { createCliOutput, type CliOutput } from '../utils/logger.js';

interface SplitFile {
  readonly name: string;
  readonly sourcePath: string;
  readonly size: number;
}

interface SplitBatch {
  readonly files: SplitFile[];
  readonly totalSize: number;
}

const splitOptionsSchema = z
  .object({
    count: z.coerce.number().int().positive().optional(),
    date: z.boolean().optional(),
    jsonl: z.boolean().optional(),
    size: z.string().optional(),
  })
  .refine((options) => {
    const selectedModes = [options.count, options.size, options.date].filter(
      Boolean,
    );
    return selectedModes.length === 1;
  }, {
    message: 'Choose exactly one split mode: --count, --size, or --date.',
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
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
      .map(async (entry) => {
        const sourcePath = path.join(sourceDir, entry.name);
        const stat = await fs.stat(sourcePath);
        return {
          name: entry.name,
          sourcePath,
          size: stat.size,
        };
      }),
  );

  return files;
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
    const destinationPath = path.join(batchDir, file.name);
    try {
      try {
        await fs.access(destinationPath);
        output.warn(`Skipped · ${file.name} · destination exists`);
        failed++;
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      await fs.rename(file.sourcePath, destinationPath);
      moved++;
      output.muted(`Moved · ${file.name}`);
    } catch (error) {
      failed++;
      output.warn(`Failed · ${file.name}`);
    }
  }

  return { failed, moved };
}

async function moveFile(
  file: SplitFile,
  destinationDir: string,
  output: CliOutput,
): Promise<'failed' | 'moved'> {
  await fs.mkdir(destinationDir, { recursive: true });

  const destinationPath = path.join(destinationDir, file.name);
  try {
    try {
      await fs.access(destinationPath);
      output.warn(`Skipped · ${file.name} · destination exists`);
      return 'failed';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    await fs.rename(file.sourcePath, destinationPath);
    output.muted(`Moved · ${file.name} · ${path.basename(destinationDir)}`);
    return 'moved';
  } catch {
    output.warn(`Failed · ${file.name}`);
    return 'failed';
  }
}

async function splitByDate(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
): Promise<{ failed: number; moved: number }> {
  let moved = 0;
  let failed = 0;

  for (const file of files) {
    const label = await dateLabelForFile(file);
    const result = await moveFile(file, path.join(outputDir, label), output);
    if (result === 'moved') {
      moved++;
    } else {
      failed++;
    }
    output.event({ v: 1, kind: 'progress', done: moved, total: files.length });
  }

  return { failed, moved };
}

export const split = new Command()
  .name('split')
  .description(
    'move files from a folder into batch subfolders in that same folder',
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
  .option('--date', 'move files into month folders based on media date metadata')
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
        output.error('No files found to split.', 'no_files');
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
            : 'Move into folders by month from available date metadata',
        );
      }

      let moved = 0;
      let failed = 0;

      if (options.date) {
        if (!output.jsonl) {
          output.blankLine();
          output.info('Moves');
        }
        const result = await splitByDate(files, outputDir, output);
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
