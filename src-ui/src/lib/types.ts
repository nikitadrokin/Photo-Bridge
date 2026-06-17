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
  readonly errorMessage?: string;
}

/** Aggregated device info fetched on connect / manual refresh. */
export interface DeviceInfoState {
  readonly status: 'idle' | 'loading' | 'ok' | 'error';
  readonly model?: string;
  readonly batteryPct?: number;
  readonly storageAvail?: string;
  readonly storageTotal?: string;
}
