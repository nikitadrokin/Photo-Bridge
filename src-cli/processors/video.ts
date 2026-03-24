import path from 'path';
import { promises as fs } from 'fs';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';
import { copyDatesFromSource, hasValidCreateDate } from '../utils/dates.js';

interface CodecInfo {
  video: string;
  audio: string;
}

/**
 * Probe video file to get codec information
 */
async function probeCodecs(inputPath: string): Promise<CodecInfo> {
  try {
    const { stdout: vcodec } = await execa('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=codec_name',
      '-of',
      'default=nw=1:nk=1',
      inputPath,
    ]);

    const { stdout: acodec } = await execa('ffprobe', [
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

    return {
      video: vcodec.trim() || 'unknown',
      audio: acodec.trim() || 'none',
    };
  } catch {
    return { video: 'unknown', audio: 'none' };
  }
}

/**
 * Process a video file by remuxing to MP4 and fixing metadata.
 * @returns `true` if output was written, `false` if skipped (unreadable).
 */
export async function processVideo(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  const baseName = path.basename(inputPath);
  const jsonUi = logger.getMode() === 'json';

  // Probe codecs
  const codecs = await probeCodecs(inputPath);

  if (codecs.video === 'unknown') {
    if (!jsonUi) {
      logger.warn(`⚠️  SKIP: Unreadable video ${baseName}`);
    }
    return false;
  }

  // Video flags: Always copy to preserve HDR/Dolby Vision
  let videoFlags: string[];
  if (codecs.video === 'hevc') {
    videoFlags = ['-c:v', 'copy', '-tag:v', 'hvc1'];
  } else if (codecs.video === 'h264') {
    videoFlags = ['-c:v', 'copy', '-tag:v', 'avc1'];
  } else {
    videoFlags = ['-c:v', 'copy'];
  }

  // Audio flags: Convert to AAC if needed
  let audioFlags: string[];
  let audioType: string;
  if (codecs.audio === 'aac') {
    audioFlags = ['-c:a', 'copy'];
    audioType = 'COPY';
  } else {
    audioFlags = ['-c:a', 'aac', '-b:a', '320k'];
    audioType = 'CONVERT';
  }

  if (!jsonUi) {
    logger.log(
      `VIDEO: ${baseName} [${codecs.video}] -> MP4 (HDR Preserved) [Audio:${audioType}]`,
    );
  }

  try {
    // Remux video - capture stderr for progress streaming
    const ffmpeg = execa('ffmpeg', [
      '-nostdin',
      '-v',
      'error',
      '-stats',
      '-i',
      inputPath,
      ...videoFlags,
      ...audioFlags,
      '-dn',
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

    // Fix dates using priority chain from source file
    await copyDatesFromSource(inputPath, outputPath);

    // Verify that dates were successfully recovered
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
      logger.error(`❌ ERROR: Failed to convert ${baseName}`);
    }
    // Clean up failed output file
    try {
      await fs.unlink(outputPath);
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Process a video file by copying it bit-for-bit and renaming it to .mp4.
 *
 * This just tells macOS to copy the file bit-for-bit, only changing the .mov extension to .mp4:
 * - no ffmpeg
 * - no ffprobe
 * - no metadata rewrite
 * - no stream changes
 * - output may not be Pixel-compatible, we are testing if it just works by uploads in Google Photos
 */
export async function copyVideo(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const baseName = path.basename(inputPath);
  const jsonUi = logger.getMode() === 'json';

  if (!jsonUi) {
    logger.log(`VIDEO: ${baseName} -> Copying .mov to .mp4 container...`);
  }

  try {
    // fs.copyFile throws errors if the file already exists
    // so we force remove it first
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
