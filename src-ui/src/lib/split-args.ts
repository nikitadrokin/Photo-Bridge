/** UI-facing split layout modes (maps to `pb split` flags). */
export type SplitMode = 'count' | 'date' | 'size';

/** Human-readable label for each {@link SplitMode}. */
export function splitModeLabel(mode: SplitMode, dateByDay = false): string {
  switch (mode) {
    case 'date':
      return dateByDay
        ? 'By month › day, hash subfolders for duplicates'
        : 'By month, hash subfolders for duplicates';
    case 'size':
      return 'By size limit per folder';
    case 'count':
      return 'By file count per folder';
  }
}

/** Builds sidecar argv for `pb split <folder> --jsonl` from UI mode. */
export function buildSplitArgs(
  folder: string,
  mode: SplitMode,
  limitValue?: string,
  dateByDay = false,
): Array<string> {
  const args = ['split', folder, '--jsonl'];
  switch (mode) {
    case 'date':
      args.push('--date');
      if (dateByDay) args.push('--day');
      break;
    case 'size':
      if (limitValue) args.push('--size', limitValue);
      break;
    case 'count':
      if (limitValue) args.push('--count', limitValue);
      break;
  }
  return args;
}
