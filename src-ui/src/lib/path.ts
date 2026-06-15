import { invoke } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';

/** Returns whether `path` exists and is a directory. */
export async function pathIsDirectory(path: string): Promise<boolean> {
  try {
    return await invoke<boolean>('path_is_directory', { path });
  } catch {
    return false;
  }
}

/** First dropped/selected path that is a directory, if any. */
export async function findDirectoryPath(
  paths: readonly string[],
): Promise<string | undefined> {
  for (const path of paths) {
    if (await pathIsDirectory(path)) {
      // return first directory path
      return path;
    }
  }

  return undefined;
}

/** Lowercase file extension from the final path segment, or empty when absent. */
export function fileExtension(path: string): string {
  const name = path.split('/').pop() ?? path;
  const dot = name.lastIndexOf('.');

  if (dot <= 0) {
    return '';
  }

  return name.slice(dot + 1).toLowerCase();
}

/** True when `path` has one of the allowed media extensions. */
export function hasValidExtension(
  path: string,
  extensions: readonly string[],
): boolean {
  const ext = fileExtension(path);
  return ext !== '' && extensions.includes(ext);
}

/**
 * Resolves the sole selected path when it is a directory (async stat check).
 * Returns null for zero, multiple, or non-directory selections.
 */
export function useSelectedDirectory(
  selectedPaths: readonly string[],
): string | null {
  const [directory, setDirectory] = useState<string | null>(null);

  useEffect(() => {
    if (selectedPaths.length !== 1) {
      setDirectory(null);
      return;
    }

    const path = selectedPaths[0];
    let cancelled = false;

    void pathIsDirectory(path).then((isDir) => {
      if (!cancelled) {
        setDirectory(isDir ? path : null);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedPaths]);

  return directory;
}
