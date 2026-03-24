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
    if (line.startsWith('Filesystem')) {
      continue;
    }
    const parts = line.split(/\s+/);
    if (parts.length >= 4) {
      return parts[3] ?? null;
    }
  }

  return null;
}

/**
 * Presents toybox/coreutils-style sizes as `17GB` instead of `17G` when the
 * value is a single-letter suffix without `B`.
 */
export function formatAvailLabel(avail: string): string {
  const x = avail.trim();
  if (/^[0-9]+(?:\.[0-9]+)?[GMTK]$/i.test(x)) {
    return `${x}B`;
  }
  return x;
}
