import { promises as fs } from 'node:fs';
import { execa } from 'execa';
import { copyDatesFromSource } from '../utils/dates.js';

interface CodecInfo {
  audio: string;
  video: string;
}

async function probeStreamCodec(
  inputPath: string,
  stream: 'a:0' | 'v:0',
): Promise<string | null> {
  try {
    const { stdout } = await execa('ffprobe', [
      '-v',
      'error',
      '-select_streams',
      stream,
      '-show_entries',
      'stream=codec_name',
      '-of',
      'default=nw=1:nk=1',
      inputPath,
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function probeCodecs(inputPath: string): Promise<CodecInfo> {
  const [video, audio] = await Promise.all([
    probeStreamCodec(inputPath, 'v:0'),
    probeStreamCodec(inputPath, 'a:0'),
  ]);
  return { video: video ?? 'unknown', audio: audio ?? 'none' };
}

function videoCodecFlags(codec: string): string[] {
  if (codec === 'hevc') return ['-c:v', 'copy', '-tag:v', 'hvc1'];
  if (codec === 'h264') return ['-c:v', 'copy', '-tag:v', 'avc1'];
  return ['-c:v', 'copy'];
}

function audioCodecFlags(codec: string): string[] {
  return codec === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '320k'];
}

/**
 * Remuxes video into MP4 without re-encoding when possible.
 * @returns false when FFmpeg cannot read the source (treated as skip).
 */
export async function processVideo(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  const codecs = await probeCodecs(inputPath);
  if (codecs.video === 'unknown') return false;

  try {
    await execa('ffmpeg', [
      '-hide_banner',
      '-loglevel',
      'error',
      '-nostdin',
      '-y',
      '-i',
      inputPath,
      ...videoCodecFlags(codecs.video),
      ...audioCodecFlags(codecs.audio),
      '-dn',
      '-movflags',
      '+faststart',
      '-map_metadata',
      '0',
      outputPath,
    ]);

  } catch (error) {
    try {
      await fs.rm(outputPath, { force: true });
    } catch {
      // Best effort cleanup only.
    }
    throw error;
  }

  try {
    await copyDatesFromSource(inputPath, outputPath);
  } catch {
    // Conversion succeeded; date repair can be reported by fix-dates later.
  }

  return true;
}
