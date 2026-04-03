import { Command } from 'commander';
import { validateTools } from '../../utils/validation.js';
import path from 'path';
import { promises as fs } from 'fs';
import { logger } from '../../utils/logger.js';
import { GpsCoordinates } from '../../utils/dates.js';
import { findJsonSidecar } from '../../utils/json-sidecar.js';
import { readGeoData } from '../../utils/json-sidecar.js';
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
    '-c, --cwd <cwd>',
    'working directory for resolving relative paths',
    process.cwd(),
  )
  .action(
    async (
      file: string,
      cmdOpts: { cwd: string; unix: number; googleTakeout?: boolean },
    ) => {
      try {
        await validateTools(['exiftool']);
        const absPath = path.resolve(cmdOpts.cwd, file);
        await fs.access(absPath);
        const st = await fs.stat(absPath);
        if (!st.isFile()) {
          logger.error('Path is not a file.');
          process.exit(1);
        }
        let gps: GpsCoordinates | undefined;
        if (cmdOpts.googleTakeout) {
          const jsonPath = await findJsonSidecar(absPath);
          if (jsonPath) {
            const g = await readGeoData(jsonPath);
            gps = g ?? undefined;
          }
        }
        await fixDatesFromTimestamp(absPath, cmdOpts.unix, gps);
        logger.success(`Applied date to ${path.basename(absPath)}`);
      } catch (err) {
        logger.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    },
  );
