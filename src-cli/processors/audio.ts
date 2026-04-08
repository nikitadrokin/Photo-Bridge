import path from 'path';
import { promises as fs } from 'fs';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import { copyDatesFromSource, hasValidCreateDate } from '../utils/dates.js';

/**
 * Probe an audio file and return the codec name of its first audio stream.
 * Returns 'unknown' if the file cannot be probed.
 */
async function probeAudioCodec(inputPath: string): Promise<string> {
  try {
    const { stdout } = await execa('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'a:0',
      '-show_entries',
      'stream=codec_name',
      '-of',
      'default=nw=1:nk=1',
      inputPath,
    ]);
    return stdout.trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Remux an audio file into an MP4 container, fixing metadata dates.
 *
 * - AAC audio streams are copied without re-encoding.
 * - All other audio codecs are transcoded to AAC at 320k.
 *
 * @returns `true` if output was written, `false` if skipped (unreadable).
 */
export async function remuxAudio(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  const baseName = path.basename(inputPath);
  const jsonUi = logger.getMode() === 'json';

  const codec = await probeAudioCodec(inputPath);

  if (codec === 'unknown') {
    if (!jsonUi) {
      logger.warn(`⚠️  SKIP: Unreadable audio ${baseName}`);
    }
    return false;
  }

  // Copy AAC streams directly; transcode everything else to AAC
  let audioFlags: string[];
  let audioType: string;
  if (codec === 'aac') {
    audioFlags = ['-c:a', 'copy'];
    audioType = 'COPY';
  } else {
    audioFlags = ['-c:a', 'aac', '-b:a', '320k'];
    audioType = 'CONVERT';
  }

  if (!jsonUi) {
    logger.log(`AUDIO: ${baseName} [${codec}] -> MP4 [Audio:${audioType}]`);
  }

  try {
    const ffmpeg = execa('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-stats',
      '-i',
      inputPath,
      '-vn', // no video stream — audio only
      ...audioFlags,
      '-movflags',
      '+faststart',
      '-map_metadata',
      '0',
      outputPath,
    ]);

    if (!jsonUi) {
      ffmpeg.stderr?.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            logger.log(`  ${trimmed}`);
          }
        }
      });
    }

    await ffmpeg;

    // Copy dates from source using the standard priority chain
    await copyDatesFromSource(inputPath, outputPath);

    if (!(await hasValidCreateDate(outputPath))) {
      if (jsonUi) {
        logger.emitJSON({
          v: 1,
          kind: 'warn',
          code: 'date_not_recovered',
          detail: baseName,
        });
      } else {
        logger.warn(
          `⚠️  WARNING: Could not recover creation date for ${baseName} - metadata may need manual correction`,
        );
      }
    }

    return true;
  } catch (error) {
    if (!jsonUi) {
      logger.error(`❌ ERROR: Failed to remux ${baseName}`);
    }
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Copy an audio file bit-for-bit and rename it to .mp4.
 *
 * No ffmpeg, no re-encoding, no metadata rewrite — identical bytes, new extension.
 * Useful for testing whether the raw audio data is accepted by Google Photos.
 */
export async function copyAudio(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const baseName = path.basename(inputPath);
  const jsonUi = logger.getMode() === 'json';

  if (!jsonUi) {
    logger.log(`AUDIO: ${baseName} -> Copying to .mp4 container...`);
  }

  try {
    // Remove any existing output file before copying
    await fs.rm(outputPath, { force: true });
    await fs.copyFile(inputPath, outputPath);
  } catch (error) {
    if (!jsonUi) {
      logger.error(`❌ ERROR: Failed to copy ${baseName}`);
    }
    try {
      await fs.rm(outputPath, { force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}
