import { promises as fs } from 'node:fs';
import type { Stats } from 'node:fs';
import path from 'node:path';

/** One path passed to the working-copy step with its resolved stat. */
export interface ExistingPathEntry {
  readonly path: string;
  readonly stat: Stats;
}

/** Maps one copied source root to its sibling destination directory. */
export interface SiblingDirectoryMapping {
  readonly sourcePath: string;
  readonly destinationPath: string;
}

/** Result of cloning source trees next to originals for non-destructive edits. */
export interface PreparedSiblingCopies {
  readonly processingPaths: Array<string>;
  readonly roots: Array<SiblingDirectoryMapping>;
  readonly pathMap: ReadonlyMap<string, string>;
}

interface PrepareSiblingDirectoryOptions {
  readonly create?: boolean;
  readonly conflictMode?: 'reuse' | 'next-available';
}

function isSameOrDescendantPath(targetPath: string, basePath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !path.isAbsolute(relativePath))
  );
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

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
 */
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

  const processingPaths = existingPaths.map((entry) => {
    const mapped = pathMap.get(entry.path);
    if (mapped === undefined) {
      throw new Error(`Missing path map entry for ${entry.path}`);
    }
    return mapped;
  });

  return {
    processingPaths,
    roots,
    pathMap,
  };
}
