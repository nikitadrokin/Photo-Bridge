import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { CliOutput } from '../../utils/logger.js';
import type {
  MoveFileResult,
  SplitBatch,
  SplitDestinationLayout,
  SplitFile,
} from './types.js';

export function destinationPathFor(
  file: SplitFile,
  destinationDir: string,
  layout: SplitDestinationLayout = 'preserve',
): string {
  const relativeName = layout === 'flat' ? file.name : file.relativePath;
  return path.join(destinationDir, relativeName);
}

/** Moves a single file into `destinationDir`, respecting the destination layout. */
export async function moveFile(
  file: SplitFile,
  destinationDir: string,
  output: CliOutput,
  layout: SplitDestinationLayout = 'preserve',
): Promise<MoveFileResult> {
  await fs.mkdir(destinationDir, { recursive: true });

  const destinationPath = destinationPathFor(file, destinationDir, layout);
  try {
    if (path.resolve(file.sourcePath) === path.resolve(destinationPath)) {
      return 'moved';
    }

    try {
      await fs.access(destinationPath);
      if (layout === 'flat') {
        output.muted(`Skipped · ${file.relativePath} · duplicate`);
        return 'skipped';
      }
      output.warn(`Skipped · ${file.relativePath} · destination exists`);
      return 'failed';
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }

    if (layout === 'preserve') {
      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
    }
    await fs.rename(file.sourcePath, destinationPath);
    output.muted(
      `Moved · ${file.relativePath} · ${path.basename(destinationDir)}`,
    );
    return 'moved';
  } catch {
    output.warn(`Failed · ${file.relativePath}`);
    return 'failed';
  }
}

/** Moves all files in a batch into `batchDir`, preserving relative paths. */
export async function moveBatch(
  batch: SplitBatch,
  batchDir: string,
  output: CliOutput,
): Promise<{ failed: number; moved: number }> {
  let moved = 0;
  let failed = 0;

  await fs.mkdir(batchDir, { recursive: true });

  for (const file of batch.files) {
    const destinationPath = destinationPathFor(file, batchDir);
    try {
      if (path.resolve(file.sourcePath) === path.resolve(destinationPath)) {
        moved++;
        continue;
      }

      try {
        await fs.access(destinationPath);
        output.warn(`Skipped · ${file.relativePath} · destination exists`);
        failed++;
        continue;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error;
        }
      }

      await fs.mkdir(path.dirname(destinationPath), { recursive: true });
      await fs.rename(file.sourcePath, destinationPath);
      moved++;
      output.muted(`Moved · ${file.relativePath}`);
    } catch (error) {
      failed++;
      output.warn(`Failed · ${file.relativePath}`);
    }
  }

  return { failed, moved };
}

/** Mutates `counts` based on the result of a single move. Skipped files count as moved. */
export function applyMoveResult(
  result: MoveFileResult,
  counts: { failed: number; moved: number },
): void {
  if (result === 'moved' || result === 'skipped') {
    counts.moved++;
  } else {
    counts.failed++;
  }
}
