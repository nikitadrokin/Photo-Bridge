import { PIXEL_CAMERA_DIR } from '@/lib/constants';

/**
 * Quotes a path for zsh/bash so spaces and quotes survive paste into Terminal.
 */
function quotePosixPath(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Builds a native `adb push` command targeting the Pixel camera roll.
 * Host paths are quoted; the device destination is a known POSIX path.
 */
export function formatAdbPushCommand(hostPaths: readonly string[]): string {
  const locals = hostPaths
    .filter((hostPath) => hostPath.length > 0)
    .map(quotePosixPath);
  return ['adb', 'push', ...locals, PIXEL_CAMERA_DIR].join(' ');
}
