export type LogType = 'error' | 'warn' | 'info' | 'success' | 'log';

export interface LogMessage {
  type: LogType;
  message: string;
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
