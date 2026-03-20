import { describe, expect, test } from 'bun:test';
import { mkdtempSync } from 'fs';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { execa } from 'execa';
import { processSpatialVideo } from '../src/pipeline/convert.js';

async function probeAudio(outputPath: string): Promise<{ codec: string; channels: number }> {
  const { stdout } = await execa('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'a:0',
    '-show_entries',
    'stream=codec_name,channels',
    '-of',
    'default=nw=1:nk=1',
    outputPath,
  ]);

  const [codec, channelStr] = stdout.trim().split('\n');
  return { codec, channels: Number(channelStr) };
}

describe('ffmpeg integration', () => {
  test('eac3 multichannel input remains eac3-compatible output', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'itp-atmos-'));
    const input = path.join(tempDir, 'atmos.mov');
    const output = path.join(tempDir, 'atmos.mp4');

    await execa('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=128x72:rate=10:duration=0.5',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=5.1:sample_rate=48000',
      '-t',
      '0.5',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-c:a',
      'eac3',
      '-metadata:s:a:0',
      'title=Dolby Atmos JOC',
      input,
    ]);

    await processSpatialVideo(input, { outputPath: output });
    const audio = await probeAudio(output);

    expect(await fs.stat(output)).toBeTruthy();
    expect(audio.codec).toBe('eac3');
    expect(audio.channels).toBe(6);
  }, 30000);

  test('multichannel PCM input produces E-AC-3 output', async () => {
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'itp-pcm-'));
    const input = path.join(tempDir, 'multi.mov');
    const output = path.join(tempDir, 'multi.mp4');

    await execa('ffmpeg', [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'testsrc=size=128x72:rate=10:duration=0.5',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=channel_layout=5.1:sample_rate=48000',
      '-t',
      '0.5',
      '-c:v',
      'libx264',
      '-preset',
      'ultrafast',
      '-c:a',
      'pcm_s16le',
      input,
    ]);

    await processSpatialVideo(input, { outputPath: output, attemptAtmos: true });
    const audio = await probeAudio(output);

    expect(await fs.stat(output)).toBeTruthy();
    expect(audio.codec).toBe('eac3');
    expect(audio.channels).toBe(6);
  }, 30000);
});
