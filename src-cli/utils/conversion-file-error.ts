/** Marks a per-file conversion failure that already produced JSONL `file` rows. */
export class ConversionFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConversionFileError';
  }
}
