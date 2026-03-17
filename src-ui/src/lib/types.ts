export type LogType = 'error' | 'warn' | 'info' | 'success' | 'log';

export interface LogMessage {
  type: LogType;
  message: string;
}
