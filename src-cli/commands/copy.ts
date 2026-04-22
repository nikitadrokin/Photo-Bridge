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
    const sourceDir = path.resolve(initialFolder);

    if (!output.jsonl) {
      output.blankLine();
      output.info('Source');
      output.indentedMuted(sourceDir);
      output.info('Destination');
      output.indentedMuted(path.resolve(newFolderPath));
      output.info('Mode');
      output.indentedMuted(
        'Copy images as-is; videos as .mp4 in sibling folder',
      );
      output.blankLine();
      output.info('Files');
      output.indentedMuted(`${total} in folder`);
      output.blankLine();
    } else {
      output.log(`Found ${total} files`);
      output.blankLine();
    }

    for (const file of files) {
      const ext = path.extname(file).slice(1);
      const initialPath = path.join(initialFolder, file);

      if (IMAGE_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands HEIC filetypes, so we don't need to convert them
        const newPath = path.join(newFolderPath, file);
        await fs.copyFile(initialPath, newPath);
        output.muted(`Copied ${file}`);
      } else if (VIDEO_EXTENSIONS.includes(ext)) {
        // Pixel 1 understands MP4 filetypes, so we just move all videos to that container
        const basename = path.basename(file, ext);

        const newPath = path.join(newFolderPath, `${basename}.mp4`);
        await fs.copyFile(initialPath, newPath);
        output.muted(`Copied ${file}`);
      } else {
        output.warn(`Skipped · ${file}`);
      }
    }

    output.blankLine();
    if (!output.jsonl) {
      output.success('Done · copy pass finished');
      output.indentedMuted(path.resolve(newFolderPath));
      output.indentedMuted('Dates not adjusted yet in this command');
    } else {
      output.success(
        `Done! Copied files to ${newFolderPath}. Note to self: I will need to fix dates in this command in the future.`,
      );
    }
  });
