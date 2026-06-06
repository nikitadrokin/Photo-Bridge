import path from 'node:path';
import { inspectMediaDates } from '../../utils/dates.js';
import { sha256File } from '../../utils/hash.js';
import type { CliOutput } from '../../utils/logger.js';
import { applyMoveResult, moveFile } from './move.js';
import { SplitProgressReporter } from './progress.js';
import type { SplitFile } from './types.js';

type SplitResult = { failed: number; moved: number };

function formatMonthLabel(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

async function dateLabelForFile(file: SplitFile): Promise<string> {
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
      return formatMonthLabel(unixSeconds);
    }
  } catch {
    // Best-effort: unreadable metadata falls back to a safe label.
  }

  return 'Unknown Date';
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
  readonly dateLabel: string;
  readonly file: SplitFile;
  readonly hashLabel: string;
}

function dateHashGroupKey(dateLabel: string, hashLabel: string): string {
  return `${dateLabel}\0${hashLabel}`;
}

/**
 * Organizes files into YYYY-MM month folders. Files that share a content hash
 * within the same month are moved into a hash subfolder so duplicates are
 * grouped together for easy manual comparison.
 */
export async function splitByDateAndHash(
  files: SplitFile[],
  outputDir: string,
  output: CliOutput,
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

    const dateLabel = await dateLabelForFile(file);
    entries.push({ file, dateLabel, hashLabel });
  }

  progress.finish();

  if (!output.jsonl) {
    output.blankLine();
    output.info('Moves');
  }

  const groupSizes = new Map<string, number>();
  for (const entry of entries) {
    const key = dateHashGroupKey(entry.dateLabel, entry.hashLabel);
    groupSizes.set(key, (groupSizes.get(key) ?? 0) + 1);
  }

  for (const entry of entries) {
    const key = dateHashGroupKey(entry.dateLabel, entry.hashLabel);
    const hasDuplicates = (groupSizes.get(key) ?? 0) > 1;
    const destinationDir = hasDuplicates
      ? path.join(outputDir, entry.dateLabel, entry.hashLabel)
      : path.join(outputDir, entry.dateLabel);

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
