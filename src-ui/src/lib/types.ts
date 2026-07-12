export type LogType = 'error' | 'warn' | 'info' | 'success' | 'log';

export interface LogMessage {
  type: LogType;
  message: string;
}

/** UI state for Pixel free-space probe via `pb shell --jsonl -- df -h …`. */
export interface AvailableStorageState {
  readonly status: 'idle' | 'loading' | 'ok' | 'error';
  /** Parsed **Avail** column when {@link status} is `ok` */
  readonly availLabel?: string;
  /**
   * Approximate free bytes from {@link availLabel} when parseable.
   * Used for push preflight; not a kernel-level exact value.
   */
  readonly availBytes?: number;
  readonly errorMessage?: string;
}

/** Result of comparing local push payload size to device free space. */
export type PushSpaceCheckResult =
  | {
      readonly status: 'ok';
      readonly needBytes: number;
      readonly freeBytes: number;
      readonly freeLabel: string;
    }
  | {
      readonly status: 'insufficient';
      readonly needBytes: number;
      readonly freeBytes: number;
      readonly freeLabel: string;
    }
  | {
      readonly status: 'unknown';
      readonly needBytes: number | null;
      readonly freeLabel?: string;
      readonly reason: string;
    };

/** Aggregated device info fetched on connect / manual refresh. */
export interface DeviceInfoState {
  readonly status: 'idle' | 'loading' | 'ok' | 'error';
  readonly model?: string;
  readonly batteryPct?: number;
  readonly storageAvail?: string;
  readonly storageTotal?: string;
}
