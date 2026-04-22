import path from 'node:path';
import type { CliOutput } from '../../utils/logger.js';
import { applyGoogleTakeoutEnhancements } from './google-takeout.js';
import {
  applyPreferredCaptureDateToOs,
  hasValidCreateDate,
  hasValidPhotoDate,
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
 * Sets each file's filesystem times from the highest-priority embedded capture date tag.
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
          await applyGoogleTakeoutEnhancements(file);
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      const ok = await applyPreferredCaptureDateToOs(file, 'video');
      if (ok) {
        if (options.googleTakeout) {
          await applyGoogleTakeoutEnhancements(file);
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        fixedCount += 1;
      } else {
        output.warn(
          `Could not recover date: ${baseName} - no valid source date found`,
        );
        failedCount += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.warn(`Error processing: ${baseName} - ${msg}`);
      failedCount += 1;
    }
  }

  for (const file of imageFiles) {
    const baseName = path.basename(file);
    try {
      if (await hasValidPhotoDate(file)) {
        if (options.googleTakeout) {
          await applyGoogleTakeoutEnhancements(file);
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        alreadyOkCount += 1;
        continue;
      }

      const ok = await applyPreferredCaptureDateToOs(file, 'photo');
      if (ok) {
        if (options.googleTakeout) {
          await applyGoogleTakeoutEnhancements(file);
        }
        if (!output.jsonl) {
          output.log(baseName);
        }
        fixedCount += 1;
      } else {
        output.warn(
          `Could not recover date: ${baseName} - no valid source date found`,
        );
        failedCount += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      output.warn(`Error processing: ${baseName} - ${msg}`);
      failedCount += 1;
    }
  }

  return { fixedCount, alreadyOkCount, failedCount };
}
