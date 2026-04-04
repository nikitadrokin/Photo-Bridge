import { Command } from 'commander';
import { validateTools } from '../../utils/validation.js';
import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../../utils/logger.js';
import { GpsCoordinates } from '../../utils/dates.js';
import { findJsonSidecar } from '../../utils/json-sidecar.js';
import { readGeoData } from '../../utils/json-sidecar.js';
import { copyPathsToSiblingDirectories } from '../../utils/sibling-directory.js';
import { fixDatesFromTimestamp } from '../../utils/dates.js';

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
      try {
        if (cmdOpts.jsonl) {
          logger.setMode('json');
        }

        await validateTools(['exiftool']);
        const absPath = path.resolve(cmdOpts.cwd, file);
        await fs.access(absPath);
        const st = await fs.stat(absPath);
        if (!st.isFile()) {
          logger.error('Path is not a file.');
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
          targetPath = workingCopy.pathMap.get(absPath) ?? absPath;
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

        // todo: FIX THIS WITH AI BECAUSE THIS CODE IS WRONG AND DOENS'T CORRELATE TO THE PROTOCOL
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

        logger.success(`Applied date to ${path.basename(targetPath)}`);
        if (copiedDirectory) {
          logger.info(`Copied folder: ${copiedDirectory.destinationPath}`);
        }
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );
