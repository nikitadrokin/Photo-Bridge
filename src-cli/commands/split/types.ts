import { z } from 'zod';
import { ALL_EXTENSIONS } from '../../utils/constants.js';

/** A single media file discovered during a recursive scan. */
export interface SplitFile {
  readonly name: string;
  /** Path relative to the source root (preserves nested folder structure on move). */
  readonly relativePath: string;
  readonly sourcePath: string;
  readonly size: number;
}

/** A group of files and their combined byte size for count/size batching. */
export interface SplitBatch {
  readonly files: SplitFile[];
  readonly totalSize: number;
}

/**
 * Controls how a file's destination path is computed inside its destination dir.
 * - `'preserve'` — keeps the file's relative path from the source root
 * - `'flat'` — uses the bare filename only (no nested subfolders)
 */
export type SplitDestinationLayout = 'flat' | 'preserve';

/** Outcome of a single file move attempt. */
export type MoveFileResult = 'failed' | 'moved' | 'skipped';

export const MEDIA_EXTENSIONS = new Set(
  ALL_EXTENSIONS.map((ext) => ext.toLowerCase()),
);

export const splitOptionsSchema = z
  .object({
    count: z.coerce.number().int().positive().optional(),
    date: z.boolean().optional(),
    hash: z.boolean().optional(),
    jsonl: z.boolean().optional(),
    recursive: z.boolean().optional(),
    size: z.string().optional(),
  })
  .refine(
    (options) => {
      if (options.recursive) {
        return (
          Boolean(options.date) &&
          !options.hash &&
          !options.count &&
          !options.size
        );
      }
      return true;
    },
    {
      message:
        '--recursive requires --date without --hash, --count, or --size.',
    },
  )
  .refine(
    (options) => {
      const hasCount = Boolean(options.count);
      const hasSize = Boolean(options.size);
      const hasDate = Boolean(options.date);
      const hasHash = Boolean(options.hash);

      if (hasDate && hasHash) {
        return !hasCount && !hasSize;
      }

      const selectedModes = [hasCount, hasSize, hasDate, hasHash].filter(
        Boolean,
      );
      return selectedModes.length === 1;
    },
    {
      message:
        'Choose --count, --size, --date, --hash, or --date with --hash together.',
    },
  );

export type SplitOptions = z.infer<typeof splitOptionsSchema>;
