import { expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync, chmodSync } from 'fs';
import os from 'os';
import path from 'path';
import { pushToPixelCamera } from '../src/pipeline/pixel_push.js';

test('mock adb push succeeds and triggers media scanner', async () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'itp-adb-'));
  const adbPath = path.join(tempDir, 'adb');
  const mediaPath = path.join(tempDir, 'sample.mp4');

  writeFileSync(mediaPath, 'fake-media');
  writeFileSync(
    adbPath,
    `#!/usr/bin/env bash
set -euo pipefail
echo "$@" >> "${tempDir}/adb.log"
`,
  );
  chmodSync(adbPath, 0o755);

  const previousPath = process.env.PATH;
  process.env.PATH = `${tempDir}:${previousPath}`;

  const result = await pushToPixelCamera(mediaPath);

  process.env.PATH = previousPath;

  expect(result.ok).toBe(true);
});
