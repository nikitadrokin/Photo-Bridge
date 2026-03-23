import { Command } from 'commander';
import { randomUUID } from 'node:crypto';
import { readdir, rename } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { stat } from 'node:fs/promises';
import kleur from 'kleur';

export const randomize = new Command('randomize')
  .description('Randomize filenames to prevent collisions in Google Photos')
  .argument('<path>', 'Directory path to process')
  .action(async (targetPath: string) => {
    try {
      // Validate directory exists
      const stats = await stat(targetPath);
      if (!stats.isDirectory()) {
        console.error(kleur.red(`Error: '${targetPath}' is not a directory.`));
        process.exit(1);
      }

      // Read directory contents
      const files = await readdir(targetPath);
      let count = 0;

      console.log(`Renaming files in: ${targetPath}`);

      // Process each file
      for (const file of files) {
        const filePath = join(targetPath, file);
        const fileStats = await stat(filePath);

        // Skip directories
        if (fileStats.isDirectory()) {
          continue;
        }

        // Extract extension
        const ext = extname(file);
        const newName = ext ? `${randomUUID()}${ext}` : randomUUID();
        const newPath = join(targetPath, newName);

        // Rename file
        await rename(filePath, newPath);
        count++;
      }

      console.log(kleur.green(`✅ Success. Randomized ${count} files.`));
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error && error.code === 'ENOENT') {
          console.error(
            kleur.red(`Error: Directory '${targetPath}' not found.`),
          );
        } else {
          console.error(kleur.red(`Error: ${error.message}`));
        }
      }
      process.exit(1);
    }
  });
