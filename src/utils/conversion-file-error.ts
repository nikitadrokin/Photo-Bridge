/**
 * Thrown after a per-file failure UI event so the top-level handler can avoid duplicate `uncaught` errors in JSON mode.
 */
export class ConversionFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionFileError';
  }
}
