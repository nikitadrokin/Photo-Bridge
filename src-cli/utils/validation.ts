import { execa } from 'execa';
import { logger } from './logger.js';

export type RequiredTool = 'ffmpeg' | 'ffprobe' | 'exiftool';

const DEFAULT_REQUIRED_TOOLS: readonly RequiredTool[] = [
  'ffmpeg',
  'ffprobe',
  'exiftool',
] as const;

/**
 * Validate that the requested tools are installed.
 */
export async function validateTools(
  requiredTools: readonly RequiredTool[] = DEFAULT_REQUIRED_TOOLS,
): Promise<void> {
  const missing: RequiredTool[] = [];
  const uniqueTools = [...new Set(requiredTools)];

  for (const tool of uniqueTools) {
    try {
      await execa('command', ['-v', tool]);
    } catch {
      missing.push(tool);
    }
  }

  if (missing.length > 0) {
    if (logger.getMode() === 'json') {
      logger.emitJSON({
        v: 1,
        kind: 'blocked',
        code: 'missing_tools',
        tools: missing,
      });
    } else {
      logger.error(`Error: Required tools not found: ${missing.join(', ')}`);
      logger.info('');
      logger.info('Install missing tools:');
      if (missing.includes('ffmpeg') || missing.includes('ffprobe')) {
        logger.info('  brew install ffmpeg');
      }
      if (missing.includes('exiftool')) {
        logger.info('  brew install exiftool');
      }
      logger.info('');
    }
    process.exit(1);
  }
}
