import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Returns a path next to `inPath` (same parent) with `suffix` appended to the basename.
 * Optionally creates the directory when `create` is true.
 */
export async function prepareSiblingDirectory(
  inPath: string,
  suffix: string,
  options: { create?: boolean } = {},
): Promise<string> {
  const resolved = path.resolve(inPath);
  const parent = path.dirname(resolved);
  const base = path.basename(resolved);
  const out = path.join(parent, `${base}${suffix}`);
  if (options.create) {
    await fs.mkdir(out, { recursive: true });
  }
  return out;
}
