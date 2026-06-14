import { Command } from 'commander';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { FileErrorReason, MediaType } from '../../types/protocol.js';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../utils/constants';
import { createCliOutput, type CliOutput } from '../utils/logger.js';
import { prepareSiblingDirectory } from '../utils/sibling-directory.js';
import { preserveFilesystemDatesFromSource } from '../utils/dates.js';
import {
  resolveConvertInputs,
  type ConvertResolveErrorCode,
} from './convert/resolve-inputs.js';

const SUFFIX = '_Copied';

const RESOLVE_ERROR_TEXT: Record<ConvertResolveErrorCode, string> = {
  no_valid_paths: 'No valid paths provided.',
  multiple_directories:
    'Multiple directories provided. Please provide only one directory.',
  no_valid_inputs: 'No valid files or directories provided.',
};

interface CopyJob {
  ext: string;
  inputPath: string;
  media: MediaType;
  name: string;
  outputPath: string;
}

function extensionOf(fileName: string): string {
  return path.extname(fileName).toLowerCase().slice(1);
}

function targetPathFor(fileName: string, outputDir: string): string | null {
  const ext = extensionOf(fileName);
  if (IMAGE_EXTENSIONS.includes(ext)) return path.join(outputDir, fileName);
  if (!VIDEO_EXTENSIONS.includes(ext)) return null;

  const stem = path.basename(fileName, path.extname(fileName));
  return path.join(outputDir, `${stem}.mp4`);
}

function copyJobForFile(inputPath: string, outputDir: string): CopyJob | null {
  const name = path.basename(inputPath);
  const ext = extensionOf(name);
  const outputPath = targetPathFor(name, outputDir);
  if (outputPath === null) return null;

  return {
    ext,
    inputPath,
    media: IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video',
    name,
    outputPath,
  };
}

async function collectCopyJobs(
  sourceDir: string,
  outputDir: string,
): Promise<CopyJob[]> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const job = copyJobForFile(path.join(sourceDir, entry.name), outputDir);
      return job ? [job] : [];
    });
}

function emitFileProgress(
  output: CliOutput,
  job: CopyJob,
  status: 'done' | 'skipped' | 'failed',
  done: number,
  total: number,
  reason?: FileErrorReason,
): void {
  output.event({
    v: 1,
    kind: 'file',
    status,
    media: job.media,
    extIn: job.ext,
    extOut: job.media === 'video' ? 'mp4' : job.ext,
    name: job.name,
    reason,
  });
  output.event({ v: 1, kind: 'progress', done, total });
}

async function runCopyJobs(
  jobs: CopyJob[],
  output: CliOutput,
): Promise<{ copied: number; failed: number; skipped: number }> {
  let copied = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const done = i + 1;

    if (path.resolve(job.inputPath) === path.resolve(job.outputPath)) {
      skipped++;
      output.muted(`Skipped · ${job.name} · same as output`);
      emitFileProgress(
        output,
        job,
        'skipped',
        done,
        jobs.length,
        'output_same_as_input',
      );
      continue;
    }

    try {
      await fs.access(job.outputPath);
      skipped++;
      output.warn(`Skipped · ${job.name} · output exists`);
      emitFileProgress(
        output,
        job,
        'skipped',
        done,
        jobs.length,
        'output_exists',
      );
      continue;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        failed++;
        output.error(`Failed · ${job.name}`);
        emitFileProgress(
          output,
          job,
          'failed',
          done,
          jobs.length,
          'processing_error',
        );
        continue;
      }
    }

    try {
      await fs.copyFile(job.inputPath, job.outputPath);
      await preserveFilesystemDatesFromSource(job.inputPath, job.outputPath);
      copied++;
      output.muted(`Copied · ${job.name}`);
      emitFileProgress(output, job, 'done', done, jobs.length);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        skipped++;
        output.muted(`Skipped · ${job.name} · output exists`);
        emitFileProgress(
          output,
          job,
          'skipped',
          done,
          jobs.length,
          'output_exists',
        );
        continue;
      }
      failed++;
      output.warn(`Failed · ${job.name}`);
      emitFileProgress(
        output,
        job,
        'failed',
        done,
        jobs.length,
        'processing_error',
      );
    }
  }

  return { copied, skipped, failed };
}

export const copy = new Command()
  .name('copy')
  .description('copy media bit-for-bit; videos are renamed to .mp4')
  .argument('[paths...]', 'directory or files to copy')
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(
    async (paths: string[], options: { cwd: string; jsonl?: boolean }) => {
      const output = createCliOutput(Boolean(options.jsonl));

      try {
        const cwd = path.resolve(options.cwd);
        const resolvedPaths = paths.map((p) => path.resolve(cwd, p));
        const resolved = await resolveConvertInputs(resolvedPaths);

        if (!resolved.ok) {
          const code = resolved.error.code;
          output.error(RESOLVE_ERROR_TEXT[code], code);
          process.exit(1);
        }

        if (resolved.plan.mode === 'directory') {
          await processDirectory(resolved.plan.directoryPath, output);
        } else {
          await processIndividualFiles(resolved.plan.filePaths, output);
        }
      } catch (error) {
        output.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    },
  );

async function processDirectory(
  sourceDir: string,
  output: CliOutput,
): Promise<void> {
  const outputDir = await prepareSiblingDirectory(sourceDir, SUFFIX, {
    create: true,
    conflictMode: 'next-available',
  });
  const jobs = await collectCopyJobs(sourceDir, outputDir);

  output.event({
    v: 1,
    kind: 'session',
    phase: 'start',
    command: 'copy',
    layout: 'directory',
    outputDir,
    total: jobs.length,
  });

  if (!output.jsonl) {
    output.blankLine();
    output.info('Source');
    output.indentedMuted(sourceDir);
    output.info('Destination');
    output.indentedMuted(outputDir);
    output.info('Mode');
    output.indentedMuted('Copy images as-is; videos as .mp4');
    output.blankLine();
    output.info('Files');
    output.indentedMuted(`${jobs.length} supported file(s)`);
    output.blankLine();
  }

  let result = { copied: 0, skipped: 0, failed: 0 };
  try {
    result = await runCopyJobs(jobs, output);
  } finally {
    output.event({
      v: 1,
      kind: 'session',
      phase: 'end',
      command: 'copy',
      layout: 'directory',
      outputDir,
      total: jobs.length,
      processed: result.copied,
      skipped: result.skipped,
      failed: result.failed,
    });
  }

  output.blankLine();
  output.success(
    `Done · ${result.copied} copied, ${result.skipped} skipped, ${result.failed} failed`,
  );
  if (!output.jsonl) output.indentedMuted(outputDir);
}

async function processIndividualFiles(
  filePaths: string[],
  output: CliOutput,
): Promise<void> {
  const jobs = filePaths.flatMap((filePath) => {
    const job = copyJobForFile(filePath, path.dirname(filePath));
    return job ? [job] : [];
  });

  if (jobs.length === 0) {
    output.error('No supported media files provided.', 'no_supported_media');
    process.exit(1);
  }

  output.event({
    v: 1,
    kind: 'session',
    phase: 'start',
    command: 'copy',
    layout: 'files',
    total: jobs.length,
  });

  if (!output.jsonl) {
    output.blankLine();
    output.info('Source');
    output.indentedMuted(`${jobs.length} file(s)`);
    output.info('Destination');
    output.indentedMuted('In-place (next to each input)');
    output.info('Mode');
    output.indentedMuted('Copy images as-is; videos as .mp4');
    output.blankLine();
  }

  let result = { copied: 0, skipped: 0, failed: 0 };
  try {
    result = await runCopyJobs(jobs, output);
  } finally {
    output.event({
      v: 1,
      kind: 'session',
      phase: 'end',
      command: 'copy',
      layout: 'files',
      total: jobs.length,
      processed: result.copied,
      skipped: result.skipped,
      failed: result.failed,
    });
  }

  output.blankLine();
  output.success(
    `Done · ${result.copied} copied, ${result.skipped} skipped, ${result.failed} failed`,
  );
}
