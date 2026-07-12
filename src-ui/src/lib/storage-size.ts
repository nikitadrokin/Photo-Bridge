/**
 * Parse a human-readable size label (df / UI storage) into bytes.
 * Accepts forms like `17G`, `17GB`, `512M`, `1.5K`, `1024`.
 */
export function parseHumanSizeToBytes(label: string): number | null {
  const trimmed = label.trim();
  if (trimmed.length === 0) return null;

  const match = /^([0-9]+(?:\.[0-9]+)?)\s*([kmgtpe]i?b?)?$/i.exec(trimmed);
  if (!match) return null;

  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 0) return null;

  const unit = (match[2] ?? '').toLowerCase();
  const mult = unitMultiplier(unit);
  if (mult === null) return null;

  return Math.floor(value * mult);
}

function unitMultiplier(unit: string): number | null {
  if (unit === '' || unit === 'b') return 1;
  if (unit === 'k' || unit === 'kb' || unit === 'ki' || unit === 'kib') {
    return 1024;
  }
  if (unit === 'm' || unit === 'mb' || unit === 'mi' || unit === 'mib') {
    return 1024 ** 2;
  }
  if (unit === 'g' || unit === 'gb' || unit === 'gi' || unit === 'gib') {
    return 1024 ** 3;
  }
  if (unit === 't' || unit === 'tb' || unit === 'ti' || unit === 'tib') {
    return 1024 ** 4;
  }
  if (unit === 'p' || unit === 'pb' || unit === 'pi' || unit === 'pib') {
    return 1024 ** 5;
  }
  if (unit === 'e' || unit === 'eb' || unit === 'ei' || unit === 'eib') {
    return 1024 ** 6;
  }
  return null;
}

/** Format byte counts for short UI labels (binary units). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'] as const;
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 10 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

/**
 * Free space must exceed the payload by this margin so the device is not
 * packed to zero (Android + Photos need a little headroom).
 */
export function pushSafetyMarginBytes(freeBytes: number): number {
  const fivePercent = Math.floor(freeBytes * 0.05);
  const fiftyMb = 50 * 1024 * 1024;
  return Math.max(fivePercent, fiftyMb);
}

/** True when `needBytes` fits in `freeBytes` after the safety margin. */
export function pushFitsInFreeSpace(
  needBytes: number,
  freeBytes: number,
): boolean {
  if (needBytes <= 0) return true;
  return needBytes + pushSafetyMarginBytes(freeBytes) <= freeBytes;
}
