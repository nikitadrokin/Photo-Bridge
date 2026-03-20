import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { promises as fs } from 'fs';
import path from 'path';
import { decidePipeline, PipelinePlan } from './decider.js';
import { inspectFile } from '../tools/ffprobe_wrapper.js';
import { runFfmpeg } from '../tools/ffmpeg_runner.js';
import { logger } from '../utils/logger.js';

interface ConvertOptions {
  outputPath: string;
  attemptAtmos?: boolean;
}

interface Manifest {
  source: string;
  derivative: string;
  spatial_audio_detected: boolean;
  audio_codec: string;
  channel_count: number;
  pipeline_mode: PipelinePlan['mode'];
  timestamp: string;
  original_sha256: string;
  derivative_sha256: string;
}

async function sha256(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  await new Promise<void>((resolve, reject) => {
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });

  return hash.digest('hex');
}

async function ensureArchived(inputPath: string, archiveDir: string): Promise<string> {
  await fs.mkdir(archiveDir, { recursive: true });
  const archivePath = path.join(archiveDir, path.basename(inputPath));
  await fs.copyFile(inputPath, archivePath);
  return archivePath;
}

async function validateDerivative(outputPath: string, expectedCodec: string): Promise<void> {
  const probe = await inspectFile(outputPath);
  const audioStream = probe.streams.find((stream) => stream.codec_type === 'audio');
  const actualCodec = audioStream?.codec_name ?? 'none';

  if (actualCodec !== expectedCodec) {
    throw new Error(`Validation failed for ${outputPath}: expected ${expectedCodec}, found ${actualCodec}`);
  }
}

export async function processSpatialVideo(inputPath: string, options: ConvertOptions): Promise<PipelinePlan> {
  const outDir = path.dirname(options.outputPath);
  const stem = path.basename(inputPath, path.extname(inputPath));
  const auditDir = path.join(outDir, `${stem}.audit`);

  await fs.mkdir(auditDir, { recursive: true });
  const probe = await inspectFile(inputPath, { auditDir });
  const plan = decidePipeline(probe);

  logger.info(`Pipeline selected for ${path.basename(inputPath)}: ${plan.mode}`);
  logger.log(`Reason: ${plan.reason}`);

  const archivePath = await ensureArchived(inputPath, path.join(auditDir, 'originals'));
  let ffmpegArgs: string[];
  let expectedCodec = 'aac';

  switch (plan.mode) {
    case 'remux-atmos':
      ffmpegArgs = [
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-map',
        '0:t?',
        '-c:v',
        'copy',
        '-c:a',
        'copy',
        '-map_metadata',
        '0',
        '-movflags',
        '+faststart',
        options.outputPath,
      ];
      expectedCodec = 'eac3';
      break;
    case 'apac-detected':
      logger.warn('APAC/ASAF detected. Archiving original and creating stereo AAC fallback.');
      ffmpegArgs = [
        '-i',
        inputPath,
        '-map_metadata',
        '0',
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '18',
        '-profile:v',
        'high',
        '-level',
        '4.2',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        options.outputPath,
      ];
      expectedCodec = 'aac';
      break;
    case 'transcode-multichannel':
      logger.warn('Experimental path: multichannel audio to E-AC-3 does not preserve Atmos objects.');
      ffmpegArgs = [
        '-i',
        inputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-c:v',
        'copy',
        '-c:a',
        'eac3',
        '-b:a',
        '768k',
        '-map_metadata',
        '0',
        '-movflags',
        '+faststart',
        options.outputPath,
      ];
      expectedCodec = options.attemptAtmos ? 'eac3' : 'eac3';
      if (options.attemptAtmos) {
        logger.warn('--attempt-atmos enabled: output is marked experimental and may not contain true Atmos metadata.');
      }
      break;
    case 'stereo-fallback':
      ffmpegArgs = [
        '-i',
        inputPath,
        '-map_metadata',
        '0',
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-c:v',
        'libx264',
        '-preset',
        'slow',
        '-crf',
        '18',
        '-profile:v',
        'high',
        '-level',
        '4.2',
        '-c:a',
        'aac',
        '-b:a',
        '256k',
        '-ac',
        '2',
        '-movflags',
        '+faststart',
        options.outputPath,
      ];
      expectedCodec = 'aac';
      break;
  }

  await runFfmpeg(ffmpegArgs);
  await validateDerivative(options.outputPath, expectedCodec);

  const manifest: Manifest = {
    source: archivePath,
    derivative: options.outputPath,
    spatial_audio_detected: plan.spatialAudioDetected,
    audio_codec: plan.audioCodec,
    channel_count: plan.channels,
    pipeline_mode: plan.mode,
    timestamp: new Date().toISOString(),
    original_sha256: await sha256(inputPath),
    derivative_sha256: await sha256(options.outputPath),
  };

  await fs.writeFile(path.join(auditDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  return plan;
}
