/** UI-facing split layout modes (maps to `pb split` flags). */
export type SplitMode = 'date' | 'size';

/** Human-readable label for each {@link SplitMode}. */
export function splitModeLabel(mode: SplitMode): string {
  switch (mode) {
    case 'date':
      return 'By month, hash subfolders for duplicates';
    case 'size':
      return 'By size limit';
  }
}

/** Builds sidecar argv for `pb split <folder> --jsonl` from UI mode. */
export function buildSplitArgs(
  folder: string,
  mode: SplitMode,
  sizeValue?: string,
): Array<string> {
  const args = ['split', folder, '--jsonl'];
  switch (mode) {
    case 'date':
      args.push('--date');
      break;
    case 'size':
      if (sizeValue) {
        args.push('--size', sizeValue);
      }
      break;
  }
  return args;
}
