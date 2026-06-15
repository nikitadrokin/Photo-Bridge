import type { SplitBatch, SplitFile } from './types.js';

const SIZE_PATTERN =
  /^(\d+(?:\.\d+)?)\s*(b|kb|kib|mb|mib|gb|gib|tb|tib)?$/i;

const SIZE_MULTIPLIERS: Record<string, number> = {
  b: 1,
  kb: 1000,
  kib: 1024,
  mb: 1000 ** 2,
  mib: 1024 ** 2,
  gb: 1000 ** 3,
  gib: 1024 ** 3,
  tb: 1000 ** 4,
  tib: 1024 ** 4,
};

/** Parses a human-readable size string (e.g. `'4gb'`, `'500mib'`) into bytes. */
export function parseSizeLimit(value: string): number {
  const match = value.trim().match(SIZE_PATTERN);
  if (!match) {
    throw new Error(
      'Invalid --size value. Use values like 500mb, 4gb, or 10gb.',
    );
  }

  const amount = Number(match[1]);
  const unit = (match[2] ?? 'b').toLowerCase();
  const multiplier = SIZE_MULTIPLIERS[unit] ?? 1;

  const bytes = Math.floor(amount * multiplier);
  if (!Number.isSafeInteger(bytes) || bytes <= 0) {
    throw new Error('Invalid --size value. Size must be greater than zero.');
  }
  return bytes;
}

/** Formats a byte count as a human-readable string (e.g. `'1.4 GB'`). */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex++;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

/** Splits `files` into fixed-size chunks of `count` files each. */
export function batchByCount(files: SplitFile[], count: number): SplitBatch[] {
  const batches: SplitBatch[] = [];
  for (let i = 0; i < files.length; i += count) {
    const batchFiles = files.slice(i, i + count);
    batches.push({
      files: batchFiles,
      totalSize: batchFiles.reduce((total, file) => total + file.size, 0),
    });
  }
  return batches;
}

/** Splits `files` into batches where each batch's total size stays within `sizeLimit` bytes. */
export function batchBySize(
  files: SplitFile[],
  sizeLimit: number,
): SplitBatch[] {
  const batches: SplitBatch[] = [];
  let currentFiles: SplitFile[] = [];
  let currentSize = 0;

  for (const file of files) {
    const wouldExceedLimit =
      currentFiles.length > 0 && currentSize + file.size > sizeLimit;
    if (wouldExceedLimit) {
      batches.push({ files: currentFiles, totalSize: currentSize });
      currentFiles = [];
      currentSize = 0;
    }

    currentFiles.push(file);
    currentSize += file.size;
  }

  if (currentFiles.length > 0) {
    batches.push({ files: currentFiles, totalSize: currentSize });
  }

  return batches;
}
