import { Command } from 'commander';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { ALL_EXTENSIONS } from '../utils/constants';

const SUFFIX = '_Copied';

export const copy = new Command()
  .name('copy')
  .description(
    'Convert photos and videos to Android 10 compatible format by copying the file to a new file extension.\nBy default, this makes a new directory to not pollute the source directory.',
  )
  .argument('<folder>', 'the folder to copy the media from')
  .action(async (initialFolder: string) => {
    // this will be a simply fs.copyFileSync for each file, but in a new directory

    // get the new folder name, and make it but await until we finish
    const newFolderName = `${path.basename(initialFolder)}${SUFFIX}`;
    const newFolderPath = path.join(initialFolder, '..', newFolderName);
    await fs.mkdir(newFolderPath, { recursive: true });

    // read the initial folder, and get all valid files with extensions
    const entries = await fs.readdir(initialFolder, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile() && !e.name.startsWith('.'))
      .map((e) => e.name);

    const total = files.length;
    console.log(`Found ${total} files`);

    for (const file of files) {
      const ext = path.extname(file).slice(1);

      if (!ALL_EXTENSIONS.includes(ext)) {
        continue;
      }

      const baseName = path.basename(file, ext);
      const initialPath = path.join(initialFolder, file);
      const newPath = path.join(newFolderPath, `${baseName}.${ext}`);

      // await fs.copyFile(initialPath, newPath);
      console.log(`copied ${file} from ${initialPath} to ${newPath}`);
    }
  });
