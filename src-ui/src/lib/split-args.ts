/** UI-facing split layout modes (maps to `pb split` flags). */
export type SplitMode = 'date' | 'date-hash' | 'hash' | 'date-recursive';

/** Human-readable label for each {@link SplitMode}. */
export function splitModeLabel(mode: SplitMode): string {
  switch (mode) {
    case 'date':
      return 'By month (YYYY-MM)';
    case 'date-hash':
      return 'By month, hash folders for duplicates';
    case 'hash':
      return 'By content hash';
    case 'date-recursive':
      return 'Flatten into month folders';
  }
}

/** Builds sidecar argv for `pb split <folder> --jsonl` from UI mode. */
export function buildSplitArgs(
  folder: string,
  mode: SplitMode,
): Array<string> {
  const args = ['split', folder, '--jsonl'];
  switch (mode) {
    case 'date':
      args.push('--date');
      break;
    case 'date-hash':
      args.push('--date', '--hash');
      break;
    case 'hash':
      args.push('--hash');
      break;
    case 'date-recursive':
      args.push('--date', '--recursive');
      break;
  }
  return args;
}
