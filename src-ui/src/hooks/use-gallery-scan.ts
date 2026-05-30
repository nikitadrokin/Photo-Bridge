import { useCallback, useEffect, useRef, useState } from 'react';
import { useCommand } from '@/hooks/use-command';
import {
  type GalleryScanResult,
  isGalleryScanEvent,
} from '@/lib/gallery-scan';

export interface GalleryScanProgress {
  readonly done: number;
  readonly total: number;
}

interface UseGalleryScanResult {
  readonly result: GalleryScanResult | null;
  readonly progress: GalleryScanProgress | null;
  readonly isScanning: boolean;
  readonly error: string | null;
  readonly scanDirectory: (directory: string) => Promise<void>;
  readonly reset: () => void;
}

/**
 * Runs `pb gallery scan --jsonl` and surfaces progress plus the final grouped payload.
 */
export function useGalleryScan(): UseGalleryScanResult {
  const { execute, isRunning, activityEvents, clearLogs } = useCommand({
    sidecar: 'binaries/pb',
  });
  const [result, setResult] = useState<GalleryScanResult | null>(null);
  const [progress, setProgress] = useState<GalleryScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const activeDirRef = useRef<string | null>(null);

  useEffect(() => {
    let latestProgress: GalleryScanProgress | null = null;
    let scanResult: GalleryScanResult | null = null;
    let scanError: string | null = null;

    for (const event of activityEvents) {
      if (event.kind === 'progress') {
        latestProgress = { done: event.done, total: event.total };
      }
      if (event.kind === 'gallery_scan' && isGalleryScanEvent(event)) {
        scanResult = event;
      }
      if (event.kind === 'error') {
        scanError = event.detail ?? event.code;
      }
    }

    if (latestProgress) {
      setProgress(latestProgress);
    }
    if (scanResult) {
      setResult(scanResult);
      setError(null);
    }
    if (scanError) {
      setError(scanError);
    }
  }, [activityEvents]);

  const reset = useCallback(() => {
    clearLogs();
    setResult(null);
    setProgress(null);
    setError(null);
    activeDirRef.current = null;
  }, [clearLogs]);

  const scanDirectory = useCallback(
    async (directory: string) => {
      activeDirRef.current = directory;
      setResult(null);
      setProgress(null);
      setError(null);
      clearLogs();

      await execute(['gallery', 'scan', directory, '--jsonl'], {
        onFinish: (code) => {
          if (activeDirRef.current !== directory) {
            return;
          }
          if (code !== 0) {
            setError((prev) => prev ?? `Scan exited with code ${code}`);
          }
        },
      });
    },
    [clearLogs, execute],
  );

  return {
    result,
    progress,
    isScanning: isRunning,
    error,
    scanDirectory,
    reset,
  };
}
