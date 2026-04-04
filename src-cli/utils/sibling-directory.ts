import { promises as fs } from 'fs';
import type { Stats } from 'fs';
import path from 'path';

export interface ExistingPathEntry {
  readonly path: string;
  readonly stat: Stats;
}

export interface SiblingDirectoryMapping {
  readonly sourcePath: string;
  readonly destinationPath: string;
}

export interface PreparedSiblingCopies {
  readonly processingPaths: Array<string>;
  readonly roots: Array<SiblingDirectoryMapping>;
  readonly pathMap: ReadonlyMap<string, string>;
}

export interface PrepareSiblingDirectoryOptions {
  readonly create?: boolean;
  readonly conflictMode?: 'reuse' | 'next-available';
}

/** Returns true when `targetPath` is the same as `basePath` or nested under it. */
function isSameOrDescendantPath(targetPath: string, basePath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

/** Check if a path exists path exists. */
async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** Finds the next unused sibling directory for the given source path and suffix. */
async function nextAvailableSiblingDirectory(
  sourcePath: string,
  suffix: string,
): Promise<string> {
  const parentDir = path.dirname(sourcePath);
  const baseName = path.basename(sourcePath) || 'Output';
  const candidateBase = `${baseName}${suffix}`;

  let attempt = 0;
  while (true) {
    const candidateName =
      attempt === 0 ? candidateBase : `${candidateBase}-${attempt + 1}`;
    const candidatePath = path.join(parentDir, candidateName);
    if (!(await pathExists(candidatePath))) {
      return candidatePath;
    }
    attempt += 1;
  }
}

/** Rewrites one source path into its matching location inside the sibling directory. */
export function mapPathIntoSiblingDirectory(
  sourcePath: string,
  sourceRoot: string,
  destinationRoot: string,
): string {
  if (sourcePath === sourceRoot) {
    return destinationRoot;
  }

  const relativePath = path.relative(sourceRoot, sourcePath);
  return path.join(destinationRoot, relativePath);
}

/** Resolves a sibling output directory and optionally creates it. */
export async function prepareSiblingDirectory(
  sourcePath: string,
  suffix: string,
  options: PrepareSiblingDirectoryOptions = {},
): Promise<string> {
  const conflictMode = options.conflictMode ?? 'reuse';
  const destinationPath =
    conflictMode === 'next-available'
      ? await nextAvailableSiblingDirectory(sourcePath, suffix)
      : path.join(
          path.dirname(sourcePath),
          `${path.basename(sourcePath) || 'Output'}${suffix}`,
        );

  if (options.create) {
    await fs.mkdir(destinationPath, { recursive: true });
  }

  return destinationPath;
}

/**
 * Copies the required source folders and returns rewritten paths inside the copies.
 *
 *  Provides error handling for missing directories. */
export async function copyPathsToSiblingDirectories(
  existingPaths: Array<ExistingPathEntry>,
  suffix: string,
): Promise<PreparedSiblingCopies> {
  const candidateRoots = [
    ...new Set(
      existingPaths.map((entry) =>
        entry.stat.isDirectory() ? entry.path : path.dirname(entry.path),
      ),
    ),
  ];

  const sourceRoots = candidateRoots.filter((candidateRoot) => {
    return !candidateRoots.some(
      (otherRoot) =>
        otherRoot !== candidateRoot &&
        isSameOrDescendantPath(candidateRoot, otherRoot),
    );
  });

  const roots: Array<SiblingDirectoryMapping> = [];
  const destinationBySource = new Map<string, string>();

  for (const sourceRoot of sourceRoots) {
    const destinationRoot = await prepareSiblingDirectory(sourceRoot, suffix, {
      conflictMode: 'next-available',
    });
    await fs.cp(sourceRoot, destinationRoot, { recursive: true });
    roots.push({
      sourcePath: sourceRoot,
      destinationPath: destinationRoot,
    });
    destinationBySource.set(sourceRoot, destinationRoot);
  }

  const pathMap = new Map<string, string>();

  for (const entry of existingPaths) {
    const sourceRoot = sourceRoots.find((root) =>
      isSameOrDescendantPath(entry.path, root),
    );

    if (!sourceRoot) {
      throw new Error(`Could not resolve copied directory for ${entry.path}`);
    }

    const destinationRoot = destinationBySource.get(sourceRoot);
    if (!destinationRoot) {
      throw new Error(`Missing copied directory for ${sourceRoot}`);
    }

    pathMap.set(
      entry.path,
      mapPathIntoSiblingDirectory(entry.path, sourceRoot, destinationRoot),
    );
  }

  return {
    processingPaths: existingPaths.map((entry) => pathMap.get(entry.path)!),
    roots,
    pathMap,
  };
}
