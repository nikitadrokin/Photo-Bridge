import path from 'path';
import { execa } from 'execa';
import { logger } from '../utils/logger.js';

export interface PixelPushResult {
  ok: boolean;
  destination: string;
  error?: string;
}

export async function pushToPixelCamera(localFile: string): Promise<PixelPushResult> {
  const filename = path.basename(localFile);
  const destination = `/sdcard/DCIM/Camera/${filename}`;

  try {
    await execa('adb', ['push', localFile, destination]);
    await execa('adb', [
      'shell',
      'am',
      'broadcast',
      '-a',
      'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
      '-d',
      `file://${destination}`,
    ]);

    logger.success(`ADB push complete: ${destination}`);
    return { ok: true, destination };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`ADB push failed for ${localFile}: ${message}`);
    return { ok: false, destination, error: message };
  }
}
