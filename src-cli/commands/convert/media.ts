import type { MediaType } from '../../../types/protocol.js';

/** Extensions handled by `pb convert` (normalized, no leading dot). */
export const IMAGE_EXTENSIONS = [
  'heic',
  'heif',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'dng',
  'webp',
] as const;

export const VIDEO_EXTENSIONS = ['mov', 'mp4', 'm4v'] as const;

export const LEGACY_VIDEO_EXTENSIONS = ['mpg', 'mpeg'] as const;

const IMG = IMAGE_EXTENSIONS as unknown as readonly string[];
const VID = VIDEO_EXTENSIONS as unknown as readonly string[];
const LEG = LEGACY_VIDEO_EXTENSIONS as unknown as readonly string[];

export function cliMediaKind(ext: string): MediaType {
  if (IMG.includes(ext)) return 'image';
  if (LEG.includes(ext)) return 'legacy_video';
  return 'video';
}

export function isSupportedMediaExtension(ext: string): boolean {
  return IMG.includes(ext) || VID.includes(ext) || LEG.includes(ext);
}

export function isImageExtension(ext: string): boolean {
  return IMG.includes(ext);
}

export function isVideoExtension(ext: string): boolean {
  return VID.includes(ext);
}

export function isLegacyVideoExtension(ext: string): boolean {
  return LEG.includes(ext);
}
