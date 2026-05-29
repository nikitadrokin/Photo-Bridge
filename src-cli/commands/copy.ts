import { Command } from 'commander';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import type { FileErrorReason, MediaType } from '../../types/protocol.js';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../utils/constants';
import { createCliOutput, type CliOutput } from '../utils/logger.js';
import { prepareSiblingDirectory } from '../utils/sibling-directory.js';

const SUFFIX = '_Copied';

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

async function collectCopyJobs(
  sourceDir: string,
  outputDir: string,
): Promise<CopyJob[]> {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.'))
    .flatMap((entry) => {
      const ext = extensionOf(entry.name);
      const outputPath = targetPathFor(entry.name, outputDir);
      if (outputPath === null) return [];
      return [
        {
          ext,
          inputPath: path.join(sourceDir, entry.name),
          media: IMAGE_EXTENSIONS.includes(ext) ? 'image' : 'video',
          name: entry.name,
          outputPath,
        },
      ];
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

export const copy = new Command()
  .name('copy')
  .description('copy media into a Pixel-friendly sibling folder')
  .argument('<folder>', 'the folder to copy the media from')
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(async (initialFolder: string, options: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(options.jsonl));
    const sourceDir = path.resolve(initialFolder);
    const outputDir = await prepareSiblingDirectory(sourceDir, SUFFIX, {
      create: true,
      conflictMode: 'next-available',
    });

    const jobs = await collectCopyJobs(sourceDir, outputDir);
    let copied = 0;
    let skipped = 0;
    let failed = 0;

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

    try {
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const done = i + 1;

        try {
          await fs.copyFile(
            job.inputPath,
            job.outputPath,
            fs.constants.COPYFILE_EXCL,
          );
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
    } finally {
      output.event({
        v: 1,
        kind: 'session',
        phase: 'end',
        command: 'copy',
        layout: 'directory',
        outputDir,
        total: jobs.length,
        processed: copied,
        skipped,
        failed,
      });
    }

    output.blankLine();
    output.success(
      `Done · ${copied} copied, ${skipped} skipped, ${failed} failed`,
    );
    if (!output.jsonl) output.indentedMuted(outputDir);
  });
