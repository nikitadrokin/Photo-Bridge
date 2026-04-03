import { Command } from 'commander';
import { validateTools } from '../../utils/validation.js';
import path from 'path';
import { promises as fs } from 'fs';
import { inspectMediaDates } from '../../utils/dates.js';

export const inspectDatesCmd = new Command('inspect')
  .description(
    'print JSON describing candidate dates for one media file (stdout; for UI tools)',
  )
  .argument('<file>', 'media file path')
  .option(
    '-c, --cwd <cwd>',
    'working directory for resolving relative paths',
    process.cwd(),
  )
  .action(async (file: string, cmdOpts: { cwd: string }) => {
    try {
      await validateTools(['exiftool']);
      const absPath = path.resolve(cmdOpts.cwd, file);
      try {
        await fs.access(absPath);
      } catch {
        process.stdout.write(
          `${JSON.stringify({ error: 'file_not_found', path: absPath })}\n`,
        );
        process.exit(1);
      }
      const st = await fs.stat(absPath);
      if (!st.isFile()) {
        process.stdout.write(
          `${JSON.stringify({ error: 'not_a_file', path: absPath })}\n`,
        );
        process.exit(1);
      }
      const result = await inspectMediaDates(absPath);
      process.stdout.write(`${JSON.stringify(result)}\n`);
    } catch (err) {
      process.stdout.write(
        `${JSON.stringify({
          error: 'inspect_failed',
          message: err instanceof Error ? err.message : String(err),
        })}\n`,
      );
      process.exit(1);
    }
  });
