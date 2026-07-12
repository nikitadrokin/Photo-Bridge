import { Command } from '@tauri-apps/plugin-shell';

/**
 * Single-quote a path for `sh -c` so spaces and metacharacters stay literal.
 */
function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Total on-disk size of one or more files/directories via `du -sk`.
 * Returns null when measurement fails (missing paths, permission, etc.).
 */
export async function measureLocalBytes(
  paths: readonly string[],
): Promise<number | null> {
  if (paths.length === 0) return 0;

  const quoted = paths.map(shQuote).join(' ');
  // -s: one total per path; -k: 1024-byte units (portable on macOS).
  const script = `du -sk ${quoted} 2>/dev/null`;

  try {
    const result = await Command.create('exec-sh', ['-c', script]).execute();
    if (result.code !== 0 && !result.stdout.trim()) {
      return null;
    }

    let totalKb = 0;
    let sawRow = false;
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      const first = trimmed.split(/\s+/)[0];
      const kb = Number(first);
      if (!Number.isFinite(kb) || kb < 0) continue;
      totalKb += kb;
      sawRow = true;
    }

    if (!sawRow) return null;
    return totalKb * 1024;
  } catch {
    return null;
  }
}
