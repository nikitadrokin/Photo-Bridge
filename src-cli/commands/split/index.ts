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
import { splitByDateAndHash } from './strategies.js';
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
    'move files into YYYY-MM folders by capture date; files that share a month and content hash are grouped into a hash subfolder for easy comparison',
  )
  .option(
    '--day',
    'with --date, add a DD subfolder inside each YYYY-MM folder (YYYY-MM/DD layout)',
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
          options.count !== undefined
            ? `Move into folders of up to ${options.count} file(s)`
            : options.size
              ? `Move into folders of up to ${options.size}`
              : options.day
                ? 'Move into YYYY-MM/DD folders; hash subfolders when duplicates share a day'
                : 'Move into YYYY-MM folders; hash subfolders when duplicates share a month',
        );
      }

      let moved = 0;
      let failed = 0;

      if (options.date) {
        if (!output.jsonl) {
          output.blankLine();
          output.info('Analyzing');
        }
        const result = await splitByDateAndHash(
          files,
          outputDir,
          output,
          Boolean(options.day),
        );
        moved = result.moved;
        failed = result.failed;
      } else {
        const batches =
          options.count !== undefined
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
