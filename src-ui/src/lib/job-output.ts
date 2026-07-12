import type { EventV1 } from '@cli-protocol';

export interface LastJobOutput {
  readonly outputDir: string;
  readonly command: 'convert' | 'copy';
  readonly processed: number;
  readonly failed: number;
  readonly skipped: number;
}

/**
 * Finds the most recent finished convert/copy session that wrote a sibling
 * output directory (directory layout with `outputDir`).
 */
export function getLastConvertOutput(
  events: readonly EventV1[],
): LastJobOutput | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const e = events[i];
    if (e.kind !== 'session' || e.phase !== 'end') continue;
    if (e.command !== 'convert' && e.command !== 'copy') continue;
    if (!e.outputDir) continue;

    return {
      outputDir: e.outputDir,
      command: e.command,
      processed: e.processed ?? 0,
      failed: e.failed ?? 0,
      skipped: e.skipped ?? 0,
    };
  }
  return null;
}
