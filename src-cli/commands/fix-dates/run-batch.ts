import path from 'node:path';
import type { CliOutput } from '../../utils/logger.js';
import { readGeoData, findJsonSidecar, readPhotoTakenTime } from './json-sidecar.js';
import {
  fixDatesFromTimestamp,
  fixDatesInPlace,
  fixDatesOnPhoto,
  hasValidCreateDate,
  hasValidPhotoDate,
  syncFilesystemDatesFromMetadata,
} from './metadata.js';

export interface FixDatesBatchOptions {
  readonly googleTakeout: boolean;
}

export interface FixDatesBatchCounts {
  readonly fixedCount: number;
  readonly alreadyOkCount: number;
  readonly failedCount: number;
}

/**
 * Runs automatic date recovery over collected video and image paths.
 */
export async function runFixDatesBatch(
  videoFiles: string[],
  imageFiles: string[],
  options: FixDatesBatchOptions,
  output: CliOutput,
): Promise<FixDatesBatchCounts> {
  let fixedCount = 0;
  let alreadyOkCount = 0;
  let failedCount = 0;

  for (const file of videoFiles) {
    const baseName = path.basename(file);

    try {
      if (await hasValidCreateDate(file)) {
        if (options.googleTakeout) {
          const jsonPath = await findJsonSidecar(file);
          if (jsonPath) {
            const timestamp = await readPhotoTakenTime(jsonPath);
            const gps = await readGeoData(jsonPath);
            if (timestamp && (gps || true)) {
              try {
                await fixDatesFromTimestamp(
                  file,
                  timestamp,
                  gps ?? undefined,
                );
              } catch {
                // Non-fatal
              }
            }
          }
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      const jsonPath = await findJsonSidecar(file);
      if (jsonPath) {
        const timestamp = await readPhotoTakenTime(jsonPath);
        if (timestamp) {
          const gps = options.googleTakeout
            ? ((await readGeoData(jsonPath)) ?? undefined)
            : undefined;
          try {
            await fixDatesFromTimestamp(file, timestamp, gps);
            if (await hasValidCreateDate(file)) {
              output.success(`Fixed (from JSON): ${baseName}`);
              fixedCount += 1;
              continue;
            }
          } catch {
            // try next method
          }
        }
      }

      if (await hasValidCreateDate(file)) {
        try {
          await syncFilesystemDatesFromMetadata(file, 'video');
        } catch {
          // Non-fatal
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      try {
        await fixDatesInPlace(file);
      } catch {
        // Writing not supported
      }

      if (await hasValidCreateDate(file)) {
        output.success(`Fixed: ${baseName}`);
        fixedCount += 1;
      } else {
        output.warn(
          `Could not recover date: ${baseName} - no valid source date found`,
        );
        failedCount += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not yet supported')) {
        output.warn(`Skipped (format not writable): ${baseName}`);
      } else {
        output.warn(`Error processing: ${baseName} - ${msg}`);
      }
      failedCount += 1;
    }
  }

  for (const file of imageFiles) {
    const baseName = path.basename(file);

    try {
      if (await hasValidPhotoDate(file)) {
        if (options.googleTakeout) {
          const jsonPath = await findJsonSidecar(file);
          if (jsonPath) {
            const timestamp = await readPhotoTakenTime(jsonPath);
            const gps = await readGeoData(jsonPath);
            if (timestamp) {
              try {
                await fixDatesFromTimestamp(
                  file,
                  timestamp,
                  gps ?? undefined,
                );
              } catch {
                // Non-fatal
              }
            }
          }
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      const jsonPath = await findJsonSidecar(file);
      if (jsonPath) {
        const timestamp = await readPhotoTakenTime(jsonPath);
        if (timestamp) {
          const gps = options.googleTakeout
            ? ((await readGeoData(jsonPath)) ?? undefined)
            : undefined;
          try {
            await fixDatesFromTimestamp(file, timestamp, gps);
            if (await hasValidPhotoDate(file)) {
              output.success(`Fixed (from JSON): ${baseName}`);
              fixedCount += 1;
              continue;
            }
          } catch {
            // try next method
          }
        }
      }

      if (await hasValidPhotoDate(file)) {
        try {
          await syncFilesystemDatesFromMetadata(file, 'photo');
        } catch {
          // Non-fatal
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      try {
        await fixDatesOnPhoto(file);
      } catch {
        // Writing not supported
      }

      if (await hasValidPhotoDate(file)) {
        output.success(`Fixed: ${baseName}`);
        fixedCount += 1;
      } else {
        output.warn(
          `Could not recover date: ${baseName} - no valid source date found`,
        );
        failedCount += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('not yet supported')) {
        output.warn(`Skipped (format not writable): ${baseName}`);
      } else {
        output.warn(`Error processing: ${baseName} - ${msg}`);
      }
      failedCount += 1;
    }
  }

  return { fixedCount, alreadyOkCount, failedCount };
}
