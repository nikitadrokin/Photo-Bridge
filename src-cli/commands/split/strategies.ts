import path from 'node:path';
import { inspectMediaDates } from '../../utils/dates.js';
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
    const inspected = await inspectMediaDates(file.sourcePath);
    const suggested = inspected.candidates.find(
      (candidate) => candidate.id === inspected.suggestedCandidateId,
    );
    const fallback = inspected.candidates.find(
      (candidate) => candidate.unixSeconds !== null,
    );
    const unixSeconds = suggested?.unixSeconds ?? fallback?.unixSeconds;
    if (unixSeconds !== undefined && unixSeconds !== null) {
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
  readonly hashLabel: string;
}

function dateHashGroupKey(dateFolder: string, hashLabel: string): string {
  return `${dateFolder}\0${hashLabel}`;
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
  const entries: DateHashEntry[] = [];
  const progress = new SplitProgressReporter(output, files.length);

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    progress.tick(index + 1, file.relativePath, 'analyze');
    const hashLabel = await hashLabelForFile(file, output);
    if (hashLabel === null) {
      counts.failed++;
      continue;
    }

    const labels = await dateLabelsForFile(file);
    const dateFolder =
      byDay && labels.day !== null
        ? path.join(labels.month, labels.day)
        : labels.month;
    entries.push({ file, dateFolder, hashLabel });
  }

  progress.finish();

  if (!output.jsonl) {
    output.blankLine();
    output.info('Moves');
  }

  const groupSizes = new Map<string, number>();
  for (const entry of entries) {
    const key = dateHashGroupKey(entry.dateFolder, entry.hashLabel);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  for (const entry of entries) {
    const key = dateHashGroupKey(entry.dateFolder, entry.hashLabel);
    const hasDuplicates = (groupSizes.get(key) ?? 0) > 1;
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
