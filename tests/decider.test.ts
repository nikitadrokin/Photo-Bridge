import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import path from 'path';
import { inspectFixture } from '../src/tools/ffprobe_wrapper.js';
import { decidePipeline } from '../src/pipeline/decider.js';

function loadFixture(name: string) {
  const fixturePath = path.join(process.cwd(), 'tests', 'fixtures', name);
  return JSON.parse(readFileSync(fixturePath, 'utf8'));
}

describe('inspect_file + decide_pipeline', () => {
  test('detects APAC/ASAF', () => {
    const probe = inspectFixture(loadFixture('apac.probe.json'));
    const plan = decidePipeline(probe);
    expect(plan.mode).toBe('apac-detected');
  });

  test('detects E-AC-3 Atmos/JOC', () => {
    const probe = inspectFixture(loadFixture('eac3_atmos.probe.json'));
    const plan = decidePipeline(probe);
    expect(plan.mode).toBe('remux-atmos');
  });

  test('routes stereo AAC to fallback', () => {
    const probe = inspectFixture(loadFixture('stereo_aac.probe.json'));
    const plan = decidePipeline(probe);
    expect(plan.mode).toBe('stereo-fallback');
  });

  test('routes multichannel PCM to experimental transcode', () => {
    const probe = inspectFixture(loadFixture('multichannel_pcm.probe.json'));
    const plan = decidePipeline(probe);
    expect(plan.mode).toBe('transcode-multichannel');
  });
});
