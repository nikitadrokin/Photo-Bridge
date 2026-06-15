/**
 * Parses `df -h` stdout and returns the **Avail** field (human-readable size)
 * from the first filesystem data row (skips the `Filesystem` header line).
 */
export function parseDfAvailable(stdout: string): string | null {
  const lines = stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    if (line.startsWith('Filesystem')) continue;
    const parts = line.split(/\s+/);
    if (parts.length >= 4) return parts[3] ?? null;
  }

  return null;
}

/**
 * Normalises toybox/coreutils-style sizes: `17G` → `17GB`.
 */
export function formatAvailLabel(avail: string): string {
  const x = avail.trim();
  return /^[0-9]+(?:\.[0-9]+)?[GMTK]$/i.test(x) ? `${x}B` : x;
}
