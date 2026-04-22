import { promises as fs } from 'node:fs';

/** Fatal resolution outcomes before any conversion work runs. */
export type ConvertResolveErrorCode =
  | 'no_valid_paths'
  | 'multiple_directories'
  | 'no_valid_inputs';

export type ConvertResolveError = Readonly<{ code: ConvertResolveErrorCode }>;

/** Directory-only batch vs explicit file list (matches Commander path stats). */
export type ConvertPlan =
  | { mode: 'directory'; directoryPath: string }
  | { mode: 'files'; filePaths: string[] };

export type ResolveConvertInputsResult =
  | { ok: true; plan: ConvertPlan }
  | { ok: false; error: ConvertResolveError };

/**
 * Maps resolved absolute paths to a single-directory run or a file list run,
 * preserving the original `convert` branching rules.
 */
export async function resolveConvertInputs(
  resolvedPaths: string[],
): Promise<ResolveConvertInputsResult> {
  const pathStats = await Promise.all(
    resolvedPaths.map(async (p) => {
      try {
        const stat = await fs.stat(p);
        return { path: p, stat, exists: true as const };
      } catch {
        return { path: p, stat: null, exists: false as const };
      }
    }),
  );

  const existingPaths = pathStats.filter((p) => p.exists);
  if (existingPaths.length === 0) {
    return { ok: false, error: { code: 'no_valid_paths' } };
  }

  const files = existingPaths.filter((p) => p.stat?.isFile());
  const directories = existingPaths.filter((p) => p.stat?.isDirectory());

  if (directories.length > 1) {
    return { ok: false, error: { code: 'multiple_directories' } };
  }

  if (directories.length === 1 && files.length === 0) {
    return { ok: true, plan: { mode: 'directory', directoryPath: directories[0].path } };
  }

  if (files.length > 0) {
    return { ok: true, plan: { mode: 'files', filePaths: files.map((f) => f.path) } };
  }

  return { ok: false, error: { code: 'no_valid_inputs' } };
}
