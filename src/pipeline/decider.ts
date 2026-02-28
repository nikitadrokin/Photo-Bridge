import { ProbeResult, ProbeStream } from '../tools/ffprobe_wrapper.js';

export type PipelineMode =
  | 'remux-atmos'
  | 'apac-detected'
  | 'transcode-multichannel'
  | 'stereo-fallback';

export interface PipelinePlan {
  mode: PipelineMode;
  audioCodec: string;
  channels: number;
  spatialAudioDetected: boolean;
  reason: string;
}

function tagValues(stream: ProbeStream, formatTags: Record<string, string>): string {
  const streamValues = Object.values(stream.tags ?? {});
  const formatValues = Object.values(formatTags);
  return [...streamValues, ...formatValues].join(' ').toLowerCase();
}

function hasAtmosSignals(stream: ProbeStream, formatTags: Record<string, string>): boolean {
  const tags = tagValues(stream, formatTags);
  return tags.includes('atmos') || tags.includes('joc') || tags.includes('dolby');
}

function hasApacSignals(stream: ProbeStream, formatTags: Record<string, string>): boolean {
  if (stream.codec_name === 'apac') {
    return true;
  }

  const tags = tagValues(stream, formatTags);
  return tags.includes('apac') || tags.includes('asaf') || tags.includes('apple positional');
}

export function decidePipeline(probe: ProbeResult): PipelinePlan {
  const audioStreams = probe.streams.filter((stream) => stream.codec_type === 'audio');
  const firstAudio = audioStreams[0];

  if (!firstAudio) {
    return {
      mode: 'stereo-fallback',
      audioCodec: 'none',
      channels: 0,
      spatialAudioDetected: false,
      reason: 'No audio stream detected.',
    };
  }

  if (firstAudio.codec_name === 'eac3' && hasAtmosSignals(firstAudio, probe.formatTags)) {
    return {
      mode: 'remux-atmos',
      audioCodec: firstAudio.codec_name,
      channels: firstAudio.channels ?? 0,
      spatialAudioDetected: true,
      reason: 'Detected E-AC-3 with Atmos/JOC signaling; remux copy path is preferred.',
    };
  }

  if (hasApacSignals(firstAudio, probe.formatTags)) {
    return {
      mode: 'apac-detected',
      audioCodec: firstAudio.codec_name ?? 'unknown',
      channels: firstAudio.channels ?? 0,
      spatialAudioDetected: true,
      reason: 'Detected APAC/ASAF signaling; ffmpeg cannot reliably preserve APAC.',
    };
  }

  if ((firstAudio.channels ?? 0) > 2) {
    return {
      mode: 'transcode-multichannel',
      audioCodec: firstAudio.codec_name ?? 'unknown',
      channels: firstAudio.channels ?? 0,
      spatialAudioDetected: false,
      reason: 'Multichannel audio present without Atmos/JOC signal; E-AC-3 fallback is experimental.',
    };
  }

  return {
    mode: 'stereo-fallback',
    audioCodec: firstAudio.codec_name ?? 'unknown',
    channels: firstAudio.channels ?? 0,
    spatialAudioDetected: false,
    reason: 'Default compatibility path using H.264 + AAC stereo for Pixel upload.',
  };
}
