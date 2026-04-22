import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { createCliOutput } from '../../utils/logger.js';
import { validateTools } from '../../utils/validation.js';
import type { GpsCoordinates } from './metadata.js';
import { findJsonSidecar, readGeoData } from './json-sidecar.js';
import { copyPathsToSiblingDirectories } from './working-copy.js';
import { fixDatesFromTimestamp } from './metadata.js';

export const applyDateCmd = new Command('apply')
  .description(
    'write embedded and filesystem dates from an explicit Unix timestamp (manual override)',
  )
  .argument('<file>', 'media file path')
  .requiredOption(
    '--unix <seconds>',
    'unix timestamp in seconds (UTC)',
    (v: string) => {
      const n = parseInt(v, 10);
      if (Number.isNaN(n)) {
        throw new Error('Invalid --unix');
      }
      return n;
    },
  )
  .option('--google-takeout', 'also write GPS from JSON sidecar when present')
  .option(
    '--overwrite-original',
    'write into the original file instead of writing to a copy of the source folder',
  )
  .option('--jsonl', 'emit machine-readable NDJSON on success')
  .option(
    '-c, --cwd <cwd>',
    'working directory for resolving relative paths',
    process.cwd(),
  )
  .action(
    async (
      file: string,
      cmdOpts: {
        cwd: string;
        unix: number;
        googleTakeout?: boolean;
        overwriteOriginal?: boolean;
        jsonl?: boolean;
      },
    ) => {
      const output = createCliOutput(Boolean(cmdOpts.jsonl));

      try {
        await validateTools();
        const absPath = path.resolve(cmdOpts.cwd, file);
        await fs.access(absPath);
        const st = await fs.stat(absPath);
        if (!st.isFile()) {
          output.error('Path is not a file.', 'not_a_file');
          process.exit(1);
        }

        let targetPath = absPath;
        let copiedDirectory:
          | { sourcePath: string; destinationPath: string }
          | undefined;

        if (!cmdOpts.overwriteOriginal) {
          const workingCopy = await copyPathsToSiblingDirectories(
            [{ path: absPath, stat: st }],
            '_FixedDates',
          );
          const mapped = workingCopy.pathMap.get(absPath);
          targetPath = mapped ?? absPath;
          copiedDirectory = workingCopy.roots[0];
        }

        let gps: GpsCoordinates | undefined;
        if (cmdOpts.googleTakeout) {
          const jsonPath = await findJsonSidecar(targetPath);
          if (jsonPath) {
            const g = await readGeoData(jsonPath);
            gps = g ?? undefined;
          }
        }
        await fixDatesFromTimestamp(targetPath, cmdOpts.unix, gps);

        if (cmdOpts.jsonl) {
          process.stdout.write(
            `${JSON.stringify({
              ok: true,
              sourcePath: absPath,
              targetPath,
              copiedDirectory,
            })}\n`,
          );
          return;
        }

        output.success(`Applied date to ${path.basename(targetPath)}`);
        if (copiedDirectory) {
          output.info(`Copied folder: ${copiedDirectory.destinationPath}`);
        }
      } catch (err) {
        output.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );
