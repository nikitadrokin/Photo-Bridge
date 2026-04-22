import { Command } from 'commander';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../utils/constants';
import { createCliOutput } from '../utils/logger.js';

const SUFFIX = '_Copied';

export const copy = new Command()
  .name('copy')
  .description(
    'Convert photos and videos to Android 10 compatible format by copying the file to a new file extension.\nBy default, this makes a new directory to not pollute the source directory.',
  )
  .argument('<folder>', 'the folder to copy the media from')
  .option('--jsonl', 'emit JSONL UI events on stdout')
  .action(async (initialFolder: string, options: { jsonl?: boolean }) => {
    const output = createCliOutput(Boolean(options.jsonl));

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
    output.log(`Found ${total} files`);
    output.blankLine();

    for (const file of files) {
      const ext = path.extname(file).slice(1);
      const initialPath = path.join(initialFolder, file);

      if (IMAGE_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands HEIC filetypes, so we don't need to convert them
        const newPath = path.join(newFolderPath, file);
        await fs.copyFile(initialPath, newPath);
        output.success(`Copied ${file}`);
      } else if (VIDEO_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands MP4 filetypes, so we just move all videos to that container
        const basename = path.basename(file, ext);

        const newPath = path.join(newFolderPath, `${basename}.mp4`);
        await fs.copyFile(initialPath, newPath);
        output.success(`Copied ${file}`);
      } else {
        output.log(`Skipped ${file}`);
      }
    }

    output.blankLine();
    output.success(
      `Done! Copied files to ${newFolderPath}. Note to self: I will need to fix dates in this command in the future.`,
    );
  });
