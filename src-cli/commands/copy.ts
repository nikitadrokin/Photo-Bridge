import { Command } from 'commander';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../utils/constants';

const SUFFIX = '_Copied';
const VIDEO_EXT = '.mp4';

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
    console.log(`Found ${total} files\n`);

    for (const file of files) {
      const ext = path.extname(file).slice(1);
      const initialPath = path.join(initialFolder, file);

      if (IMAGE_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands HEIC filetypes, so we don't need to convert them
        const newPath = path.join(newFolderPath, file);
        await fs.copyFile(initialPath, newPath);
        console.log(`Copied ${file}`);
      } else if (VIDEO_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands MP4 filetypes, so we just move all videos to that container
        const basename = path.basename(file, ext);

        const newPath = path.join(newFolderPath, `${basename}.${VIDEO_EXT}`);
        await fs.copyFile(initialPath, newPath);
        console.log(`Copied ${file}`);
      } else {
        console.log(`Skipped ${file}`);
      }
    }

    console.log(
      `\nDone! Copied files to ${newFolderPath}. Note to self: I will need to fix dates in this command in the future.`,
    );
  });
