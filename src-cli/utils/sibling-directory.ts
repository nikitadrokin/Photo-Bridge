import { promises as fs } from 'node:fs';
import type { Stats } from 'node:fs';
import path from 'node:path';

export interface ExistingPathEntry {
  readonly path: string;
  readonly stat: Stats;
}

export interface SiblingDirectoryMapping {
  readonly sourcePath: string;
  readonly destinationPath: string;
}

export interface PreparedSiblingCopies {
  readonly processingPaths: string[];
  readonly roots: SiblingDirectoryMapping[];
  readonly pathMap: ReadonlyMap<string, string>;
}

export interface PrepareSiblingDirectoryOptions {
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

  for (let attempt = 0; ; attempt++) {
    const candidateName =
      attempt === 0 ? candidateBase : `${candidateBase}-${attempt + 1}`;
    const candidatePath = path.join(parentDir, candidateName);
    if (!(await pathExists(candidatePath))) return candidatePath;
  }
}

export function mapPathIntoSiblingDirectory(
  sourcePath: string,
  sourceRoot: string,
  destinationRoot: string,
): string {
  if (sourcePath === sourceRoot) return destinationRoot;
  return path.join(destinationRoot, path.relative(sourceRoot, sourcePath));
}

/**
 * Returns a path next to `inPath` (same parent) with `suffix` appended to the basename.
 * Optionally creates the directory when `create` is true.
 */
export async function prepareSiblingDirectory(
  inPath: string,
  suffix: string,
  options: PrepareSiblingDirectoryOptions = {},
): Promise<string> {
  const resolved = path.resolve(inPath);
  const conflictMode = options.conflictMode ?? 'reuse';
  const out =
    conflictMode === 'next-available'
      ? await nextAvailableSiblingDirectory(resolved, suffix)
      : path.join(
          path.dirname(resolved),
          `${path.basename(resolved) || 'Output'}${suffix}`,
        );

  if (options.create) {
    await fs.mkdir(out, { recursive: true });
  }
  return out;
}

export async function copyPathsToSiblingDirectories(
  existingPaths: ExistingPathEntry[],
  suffix: string,
): Promise<PreparedSiblingCopies> {
  const candidateRoots = [
    ...new Set(
      existingPaths.map((entry) =>
        entry.stat.isDirectory() ? entry.path : path.dirname(entry.path),
      ),
    ),
  ];

  const sourceRoots = candidateRoots.filter(
    (candidateRoot) =>
      !candidateRoots.some(
        (otherRoot) =>
          otherRoot !== candidateRoot &&
          isSameOrDescendantPath(candidateRoot, otherRoot),
      ),
  );

  const roots: SiblingDirectoryMapping[] = [];
  const destinationBySource = new Map<string, string>();

  for (const sourceRoot of sourceRoots) {
    const destinationRoot = await prepareSiblingDirectory(sourceRoot, suffix, {
      conflictMode: 'next-available',
    });
    await fs.cp(sourceRoot, destinationRoot, { recursive: true });
    roots.push({ sourcePath: sourceRoot, destinationPath: destinationRoot });
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
