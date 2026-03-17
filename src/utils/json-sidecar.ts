import { promises as fs } from 'fs';
import path from 'path';

/**
 * Google Photos JSON sidecar structure (from Google Takeout)
 */
export interface GooglePhotosJSON {
  photoTakenTime?: {
    timestamp: string; // Unix epoch seconds as string
    formatted?: string;
  };
  creationTime?: {
    timestamp: string;
    formatted?: string;
  };
  geoData?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  description?: string;
  title?: string;
}

/**
 * Find the JSON sidecar file for a media file.
 * Google Takeout creates sidecars with various naming patterns:
 * - photo.jpg → photo.jpg.supplemental-metadata.json (most common)
 * - photo.jpg → photo.jpg.suppl.json (shortened variant)
 * - photo.jpg → photo.jpg.supplemental.json (another variant)
 * - photo.jpg → photo.jpg.json (less common, older exports)
 * - photo.jpg → photo.json (rare, filename without extension)
 */
export async function findJsonSidecar(
  mediaPath: string,
): Promise<string | null> {
  const dir = path.dirname(mediaPath);
  const basename = path.basename(mediaPath);

  // Check patterns in order of likelihood
  const patterns = [
    `${basename}.supplemental-metadata.json`, // Most common Google Takeout format
    `${basename}.suppl.json`, // Shortened variant
    `${basename}.supplemental.json`, // Another variant
    `${basename}.json`, // Legacy format
  ];

  for (const pattern of patterns) {
    const sidecarPath = path.join(dir, pattern);
    try {
      await fs.access(sidecarPath);
      return sidecarPath;
    } catch {
      // Continue to next pattern
    }
  }

  // Fallback: filename.json (without extension) - rare
  const nameWithoutExt = path.basename(mediaPath, path.extname(mediaPath));
  const altSidecar = path.join(dir, `${nameWithoutExt}.json`);
  try {
    await fs.access(altSidecar);
    return altSidecar;
  } catch {
    // No sidecar found
  }

  return null;
}

/**
 * Read and parse the photoTakenTime timestamp from a JSON sidecar.
 * Returns the Unix timestamp in seconds, or null if not found/invalid.
 */
export async function readPhotoTakenTime(
  jsonPath: string,
): Promise<number | null> {
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const json: GooglePhotosJSON = JSON.parse(content);

    // Primary: photoTakenTime
    if (json.photoTakenTime?.timestamp) {
      const timestamp = parseInt(json.photoTakenTime.timestamp, 10);
      if (!isNaN(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }

    // Fallback: creationTime (less reliable but better than nothing)
    if (json.creationTime?.timestamp) {
      const timestamp = parseInt(json.creationTime.timestamp, 10);
      if (!isNaN(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Convert Unix timestamp (seconds) to exiftool-compatible datetime string.
 * Format: "YYYY:MM:DD HH:MM:SS"
 */
export function unixToExifDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}:${month}:${day} ${hours}:${minutes}:${seconds}`;
}
