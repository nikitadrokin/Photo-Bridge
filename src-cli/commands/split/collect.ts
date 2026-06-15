import { promises as fs } from 'node:fs';
import path from 'node:path';
import { MEDIA_EXTENSIONS, type SplitFile } from './types.js';

/** Recursively walks `sourceDir` and returns all supported media files sorted by relative path. */
export async function collectFiles(sourceDir: string): Promise<SplitFile[]> {
  const files: SplitFile[] = [];

  async function walk(dir: string, relativeDir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const relativePath = relativeDir
        ? path.join(relativeDir, entry.name)
        : entry.name;
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, relativePath);
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase().slice(1);
      if (!MEDIA_EXTENSIONS.has(ext)) continue;

      const stat = await fs.stat(fullPath);
      files.push({
        name: entry.name,
        relativePath,
        sourcePath: fullPath,
        size: stat.size,
      });
    }
  }

  await walk(sourceDir, '');
  return files.sort((a, b) =>
    a.relativePath.localeCompare(b.relativePath, undefined, { numeric: true }),
  );
}
