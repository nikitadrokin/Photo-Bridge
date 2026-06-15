import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

/** SHA-256 hex digest of a file's contents (streamed, suitable for large media). */
export async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest('hex');
}
