import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { createCliOutput } from '../../utils/logger.js';
import {
  batchByCount,
  batchBySize,
  formatBytes,
  parseSizeLimit,
} from './batch.js';
import { collectFiles } from './collect.js';
import { moveBatch } from './move.js';
import { splitByDate, splitByDateAndHash, splitByHash } from './strategies.js';
import { splitOptionsSchema, type SplitOptions } from './types.js';

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
    'move files into month folders (YYYY-MM) from media date metadata; combine with --hash for date folders with hash subfolders for duplicates',
  )
  .option(
    '--hash',
    'move files into SHA-256 hash folders (flat files inside); combine with --date for YYYY-MM layout with hash folders for duplicates',
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

      if (!output.jsonl) {
        output.info('Scanning');
        output.indentedMuted(sourceDir);
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
        output.indentedMuted(`${files.length} media file(s)`);
        output.info('Mode');
        output.indentedMuted(
          options.count
            ? `Move into folders of up to ${options.count} file(s)`
            : options.size
            ? `Move into folders of up to ${options.size}`
            : options.date && options.hash
            ? 'Move into YYYY-MM folders; hash subfolders only when duplicates share a month'
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
          output.info('Analyzing');
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
          : batchBySize(files, parseSizeLimit(options.size ?? ''));

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
            `Part ${String(i + 1).padStart(
              String(batches.length).length,
              '0',
            )}`,
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
