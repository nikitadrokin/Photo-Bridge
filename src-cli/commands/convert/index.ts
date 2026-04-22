import { promises as fs } from 'node:fs';
import path from 'node:path';
import { Command } from 'commander';
import { z } from 'zod';
import {
  createCliOutput,
  type CliOutput,
} from '../../utils/logger.js';
import { prepareSiblingDirectory } from '../../utils/sibling-directory.js';
import { validateTools } from '../../utils/validation.js';
import { ConversionFileError } from '../../utils/conversion-file-error.js';
import { isSupportedMediaExtension } from './media.js';
import { runConvertProcessFiles } from './process-files.js';
import {
  resolveConvertInputs,
  type ConvertResolveErrorCode,
} from './resolve-inputs.js';

const RESOLVE_ERROR_TEXT: Record<ConvertResolveErrorCode, string> = {
  no_valid_paths: 'No valid paths provided.',
  multiple_directories:
    'Multiple directories provided. Please provide only one directory.',
  no_valid_inputs: 'No valid files or directories provided.',
};

const convertOptionsSchema = z.object({
  cwd: z.string(),
  jsonl: z.boolean().optional(),
});

type ConvertOptions = z.infer<typeof convertOptionsSchema>;

export const convert = new Command()
  .name('convert')
  .description('convert iOS media files to Pixel-compatible format')
  .argument('[paths...]', 'directory or files to convert', ['Part1'])
  .option(
    '-c, --cwd <cwd>',
    'the working directory. defaults to the current directory.',
    process.cwd(),
  )
  .option('--jsonl', 'enable JSON output for UI integration')
  .action(async (paths: string[], opts: ConvertOptions) => {
    const options = convertOptionsSchema.parse({
      cwd: path.resolve(opts.cwd),
      jsonl: opts.jsonl,
    });
    const output = createCliOutput(Boolean(options.jsonl));

    try {
      const resolvedPaths = paths.map((p) => path.resolve(options.cwd, p));
      const resolved = await resolveConvertInputs(resolvedPaths);

      if (!resolved.ok) {
        const code = resolved.error.code;
        output.error(RESOLVE_ERROR_TEXT[code], code);
        process.exit(1);
      }

      if (resolved.plan.mode === 'directory') {
        await processDirectory(resolved.plan.directoryPath, output);
      } else {
        await processIndividualFiles(resolved.plan.filePaths, output);
      }
    } catch (error) {
      if (output.jsonl) {
        if (!(error instanceof ConversionFileError)) {
          output.error(
            error instanceof Error ? error.message : String(error),
            'uncaught',
          );
        }
      } else {
        output.blankLine();
        output.error(error instanceof Error ? error.message : String(error));
      }
      process.exit(1);
    }
  });

async function processDirectory(
  dirPath: string,
  output: CliOutput,
): Promise<void> {
  const inDir = path.resolve(dirPath);
  const outDir = await prepareSiblingDirectory(inDir, '_Remuxed', {
    create: true,
  });

  if (!output.jsonl) {
    output.blankLine();
    output.info('Source');
    output.muted(inDir);
    output.info('Destination');
    output.muted(outDir);
    output.info('Mode');
    output.muted('Remux to MP4 (stream copy, no re-encode)');
    output.blankLine();
  }

  await validateTools();

  const entries = await fs.readdir(inDir, { withFileTypes: true });
  const regularFiles = entries
    .filter((f) => f.isFile() && !f.name.startsWith('.'))
    .map((f) => path.join(inDir, f.name));

  const { processedCount, skippedCount } = await runConvertProcessFiles(
    regularFiles,
    outDir,
    output,
  );

  if (!output.jsonl) {
    output.blankLine();
    output.success(
      `Done · ${processedCount} processed, ${skippedCount} skipped`,
    );
    output.muted(`Copy to Pixel: ${outDir}`);
    output.blankLine();
  }
}

async function processIndividualFiles(
  filePaths: string[],
  output: CliOutput,
): Promise<void> {
  const regularFiles = filePaths.filter((f) => {
    const ext = path.extname(f).toLowerCase().slice(1);
    return isSupportedMediaExtension(ext);
  });

  if (regularFiles.length === 0) {
    output.error('No supported media files provided.', 'no_supported_media');
    process.exit(1);
  }

  if (!output.jsonl) {
    output.blankLine();
    output.info('Source');
    output.muted(`${regularFiles.length} file(s)`);
    output.info('Destination');
    output.muted('In-place (next to each input)');
    output.info('Mode');
    output.muted('Remux / copy to Pixel-friendly MP4');
    output.blankLine();
  }

  await validateTools();

  const { processedCount, skippedCount } = await runConvertProcessFiles(
    regularFiles,
    null,
    output,
  );

  if (!output.jsonl) {
    output.blankLine();
    output.success(
      `Done · ${processedCount} processed, ${skippedCount} skipped`,
    );
    output.blankLine();
  }
}
