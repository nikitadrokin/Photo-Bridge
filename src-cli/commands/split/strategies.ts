import path from 'node:path';
import { mapConcurrent } from '../../utils/concurrency.js';
import { readMediaCaptureUnixSeconds } from '../../utils/dates.js';
import { sha256File } from '../../utils/hash.js';
import type { CliOutput } from '../../utils/logger.js';
import { applyMoveResult, moveFile } from './move.js';
import { SplitProgressReporter } from './progress.js';
import type { SplitFile } from './types.js';

type SplitResult = { failed: number; moved: number };

interface DateLabels {
  /** YYYY-MM, or 'Unknown Date' when metadata is unavailable. */
  readonly month: string;
  /** Zero-padded day of month (01–31), or null when date is unknown. */
  readonly day: string | null;
}

function parseDateLabels(unixSeconds: number): DateLabels {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return { month: `${year}-${month}`, day };
}

async function dateLabelsForFile(file: SplitFile): Promise<DateLabels> {
  try {
    const unixSeconds = await readMediaCaptureUnixSeconds(file.sourcePath);
    if (unixSeconds !== null) {
      return parseDateLabels(unixSeconds);
    }
  } catch {
    // Best-effort: unreadable metadata falls back to a safe label.
  }

  return { month: 'Unknown Date', day: null };
}

async function hashLabelForFile(
  file: SplitFile,
  output: CliOutput,
): Promise<string | null> {
  try {
    return await sha256File(file.sourcePath);
  } catch {
    output.warn(`Skipped · ${file.relativePath} · could not hash file`);
    return null;
  }
}

interface DateHashEntry {
  /** The resolved date folder path: 'YYYY-MM' or 'YYYY-MM/DD' (or 'Unknown Date'). */
  readonly dateFolder: string;
  readonly file: SplitFile;
  readonly hashLabel: string | null;
}

type DateEntry = Omit<DateHashEntry, 'hashLabel'>;

function dateHashGroupKey(dateFolder: string, hashLabel: string): string {
  return `${dateFolder}\0${hashLabel}`;
}

const DATE_READ_CONCURRENCY = 8;
const HASH_CONCURRENCY = 3;

async function dateEntryForFile(
  file: SplitFile,
  byDay: boolean,
): Promise<DateEntry> {
  const labels = await dateLabelsForFile(file);
  const dateFolder =
    byDay && labels.day !== null
      ? path.join(labels.month, labels.day)
      : labels.month;
  return { file, dateFolder };
}

/**
 * Organizes files into YYYY-MM month folders (or YYYY-MM/DD when `byDay` is
 * true). Files that share a content hash within the same date bucket are moved
 * into a hash subfolder so duplicates are grouped together for easy comparison.
 */
export async function splitByDateAndHash(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
  byDay = false,
): Promise<SplitResult> {
  const counts = { moved: 0, failed: 0 };
  const progress = new SplitProgressReporter(output, files.length);

  let datesDone = 0;
  const dateEntries = await mapConcurrent(
    files,
    DATE_READ_CONCURRENCY,
    async (file) => {
      const entry = await dateEntryForFile(file, byDay);
      datesDone += 1;
      progress.tick(datesDone, file.relativePath, 'read_dates');
      return entry;
    },
  );
  progress.finish();

  const possibleDuplicateGroups = new Map<string, DateEntry[]>();
  for (const entry of dateEntries) {
    const key = `${entry.dateFolder}\0${entry.file.size}`;
    const group = possibleDuplicateGroups.get(key);
    if (group) {
      group.push(entry);
    } else {
      possibleDuplicateGroups.set(key, [entry]);
    }
  }

  const entries: DateHashEntry[] = [];
  const hashCandidates = new Set<SplitFile>();
  for (const group of possibleDuplicateGroups.values()) {
    if (group.length === 1) {
      entries.push({ ...group[0], hashLabel: null });
      continue;
    }

    for (const entry of group) {
      hashCandidates.add(entry.file);
    }
  }

  const hashLabels = new Map<SplitFile, string>();
  if (hashCandidates.size > 0) {
    const hashProgress = new SplitProgressReporter(
      output,
      hashCandidates.size,
      { emitEvents: false },
    );
    const hashFiles = [...hashCandidates];
    let hashesDone = 0;
    const hashResults = await mapConcurrent(
      hashFiles,
      HASH_CONCURRENCY,
      async (file) => {
        const hashLabel = await hashLabelForFile(file, output);
        hashesDone += 1;
        hashProgress.tick(hashesDone, file.relativePath, 'hash');
        return { file, hashLabel };
      },
    );
    hashProgress.finish();

    for (const result of hashResults) {
      if (result.hashLabel === null) {
        counts.failed++;
      } else {
        hashLabels.set(result.file, result.hashLabel);
      }
    }

    for (const group of possibleDuplicateGroups.values()) {
      if (group.length <= 1) continue;
      for (const entry of group) {
        const hashLabel = hashLabels.get(entry.file);
        if (hashLabel !== undefined) {
          entries.push({ ...entry, hashLabel });
        }
      }
    }
  }

  if (!output.jsonl) {
    output.blankLine();
    output.info('Moves');
  }

  const groupSizes = new Map<string, number>();
  for (const entry of entries) {
    if (entry.hashLabel === null) continue;
    const key = dateHashGroupKey(entry.dateFolder, entry.hashLabel);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  for (const entry of entries) {
    const hasDuplicates =
      entry.hashLabel !== null &&
      (groupSizes.get(dateHashGroupKey(entry.dateFolder, entry.hashLabel)) ??
        0) > 1;
    const destinationDir = hasDuplicates
      ? path.join(outputDir, entry.dateFolder, entry.hashLabel)
      : path.join(outputDir, entry.dateFolder);

    const result = await moveFile(entry.file, destinationDir, output, 'flat');
    applyMoveResult(result, counts);
    output.event({
      v: 1,
      kind: 'progress',
      done: counts.moved + counts.failed,
      total: files.length,
    });
  }

  return counts;
}
