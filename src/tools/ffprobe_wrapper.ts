import { promises as fs } from 'fs';
import path from 'path';
import { execa } from 'execa';

export interface ProbeStream {
  index: number;
  codec_name?: string;
  codec_type?: string;
  channels?: number;
  channel_layout?: string;
  tags?: Record<string, string>;
}

export interface ProbeResult {
  sourcePath: string;
  formatName: string;
  formatTags: Record<string, string>;
  streams: ProbeStream[];
  raw: {
    format?: {
      format_name?: string;
      tags?: Record<string, string>;
    };
    streams?: ProbeStream[];
  };
}

interface ProbeOptions {
  auditDir?: string;
}

function normalizeProbe(inputPath: string, parsed: ProbeResult['raw']): ProbeResult {
  return {
    sourcePath: inputPath,
    formatName: parsed.format?.format_name ?? 'unknown',
    formatTags: parsed.format?.tags ?? {},
    streams: (parsed.streams ?? []).map((stream) => ({
      index: stream.index,
      codec_name: stream.codec_name,
      codec_type: stream.codec_type,
      channels: stream.channels,
      channel_layout: stream.channel_layout,
      tags: stream.tags ?? {},
    })),
    raw: parsed,
  };
}

function getProbeOutputPath(inputPath: string, auditDir?: string): string {
  const filename = `${path.basename(inputPath)}.probe.json`;
  return auditDir ? path.join(auditDir, filename) : `${inputPath}.probe.json`;
}

export async function inspectFile(inputPath: string, options: ProbeOptions = {}): Promise<ProbeResult> {
  const { stdout } = await execa('ffprobe', [
    '-v',
    'quiet',
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    inputPath,
  ]);

  const parsed = JSON.parse(stdout) as ProbeResult['raw'];
  const normalized = normalizeProbe(inputPath, parsed);
  const outputPath = getProbeOutputPath(inputPath, options.auditDir);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, JSON.stringify(parsed, null, 2));

  return normalized;
}

export function inspectFixture(json: ProbeResult['raw'], sourcePath = 'fixture.mov'): ProbeResult {
  return normalizeProbe(sourcePath, json);
}
