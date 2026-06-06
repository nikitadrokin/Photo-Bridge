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

/** A group of files and their combined byte size for size-based batching. */
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
    date: z.boolean().optional(),
    jsonl: z.boolean().optional(),
    size: z.string().optional(),
  })
  .refine(
    (options) => {
      const hasDate = Boolean(options.date);
      const hasSize = Boolean(options.size);
      return hasDate !== hasSize;
    },
    {
      message: 'Choose exactly one of --date or --size.',
    },
  );

export type SplitOptions = z.infer<typeof splitOptionsSchema>;
