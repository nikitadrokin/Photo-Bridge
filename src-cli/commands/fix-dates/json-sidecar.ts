import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * Google Photos JSON sidecar structure (from Google Takeout).
 */
export interface GooglePhotosJSON {
  photoTakenTime?: {
    timestamp: string;
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

/** GPS payload read from Takeout `geoData`. */
export interface GeoData {
  latitude: number;
  longitude: number;
  altitude: number | null;
}

/**
 * Extract GPS coordinates from the geoData field in the Takeout JSON.
 * Returns null if geoData is absent or all coordinates are zero (no fix).
 */
export async function readGeoData(jsonPath: string): Promise<GeoData | null> {
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const json: GooglePhotosJSON = JSON.parse(content) as GooglePhotosJSON;

    if (!json.geoData) return null;

    const { latitude, longitude, altitude } = json.geoData;

    if (latitude === 0 && longitude === 0) return null;

    return {
      latitude,
      longitude,
      altitude: altitude !== undefined ? altitude : null,
    };
  } catch {
    return null;
  }
}

/**
 * Find the JSON sidecar file for a media file (Takeout naming patterns and truncation fallback).
 */
export async function findJsonSidecar(
  mediaPath: string,
): Promise<string | null> {
  const dir = path.dirname(mediaPath);
  const basename = path.basename(mediaPath);

  const patterns = [
    `${basename}.supplemental-metadata.json`,
    `${basename}.suppl.json`,
    `${basename}.supplemental.json`,
    `${basename}.json`,
  ];

  for (const pattern of patterns) {
    const sidecarPath = path.join(dir, pattern);
    try {
      await fs.access(sidecarPath);
      return sidecarPath;
    } catch {
      // try next pattern
    }
  }

  const nameWithoutExt = path.basename(mediaPath, path.extname(mediaPath));
  const altSidecar = path.join(dir, `${nameWithoutExt}.json`);
  try {
    await fs.access(altSidecar);
    return altSidecar;
  } catch {
    // continue
  }

  const TRUNCATION_PREFIX_LEN = 46;
  if (basename.length > TRUNCATION_PREFIX_LEN) {
    const prefix = basename.slice(0, TRUNCATION_PREFIX_LEN);
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry.endsWith('.json') && entry.startsWith(prefix)) {
          return path.join(dir, entry);
        }
      }
    } catch {
      return null;
    }
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
    const json: GooglePhotosJSON = JSON.parse(content) as GooglePhotosJSON;

    if (json.photoTakenTime?.timestamp) {
      const timestamp = parseInt(json.photoTakenTime.timestamp, 10);
      if (!Number.isNaN(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }

    if (json.creationTime?.timestamp) {
      const timestamp = parseInt(json.creationTime.timestamp, 10);
      if (!Number.isNaN(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/** One Takeout JSON time field surfaced for manual date picking in the UI. */
export interface TakeoutTimeCandidate {
  readonly id: 'json:photoTakenTime' | 'json:creationTime';
  readonly label: string;
  readonly raw: string;
  readonly unixSeconds: number | null;
}

/**
 * Reads both Takeout time fields as separate candidates (photoTakenTime and creationTime).
 */
export async function readTakeoutTimeCandidates(
  jsonPath: string,
): Promise<TakeoutTimeCandidate[]> {
  try {
    const content = await fs.readFile(jsonPath, 'utf-8');
    const json: GooglePhotosJSON = JSON.parse(content) as GooglePhotosJSON;
    const out: TakeoutTimeCandidate[] = [];

    if (json.photoTakenTime?.timestamp) {
      const timestamp = parseInt(json.photoTakenTime.timestamp, 10);
      const ok = !Number.isNaN(timestamp) && timestamp > 0;
      out.push({
        id: 'json:photoTakenTime',
        label: 'Takeout photoTakenTime',
        raw:
          json.photoTakenTime.formatted?.trim() ||
          json.photoTakenTime.timestamp,
        unixSeconds: ok ? timestamp : null,
      });
    }

    if (json.creationTime?.timestamp) {
      const timestamp = parseInt(json.creationTime.timestamp, 10);
      const ok = !Number.isNaN(timestamp) && timestamp > 0;
      out.push({
        id: 'json:creationTime',
        label: 'Takeout creationTime',
        raw:
          json.creationTime.formatted?.trim() || json.creationTime.timestamp,
        unixSeconds: ok ? timestamp : null,
      });
    }

    return out;
  } catch {
    return [];
  }
}
