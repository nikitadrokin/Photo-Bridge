/** One recoverable date source (EXIF or Takeout JSON). */
export interface MediaDateCandidate {
  readonly id: string;
  readonly label: string;
  readonly raw: string;
  readonly unixSeconds: number | null;
}

/** Parsed `pb fix-dates inspect` success payload. */
export interface MediaDateInspectResult {
  readonly path: string;
  readonly basename: string;
  readonly mediaKind: 'video' | 'photo' | 'unknown';
  readonly hasAutomaticDateOk: boolean;
  readonly suggestedCandidateId: string | null;
  readonly candidates: Array<MediaDateCandidate>;
}

/** Error object written to stdout when inspect fails. */
export interface MediaDateInspectError {
  readonly error: string;
  readonly path?: string;
  readonly message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMediaDateCandidate(value: unknown): value is MediaDateCandidate {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    typeof value.raw === 'string' &&
    (value.unixSeconds === null || typeof value.unixSeconds === 'number')
  );
}

function isInspectSuccess(value: unknown): value is MediaDateInspectResult {
  if (!isRecord(value)) return false;
  if (typeof value.error === 'string') return false;
  const kind = value.mediaKind;
  if (kind !== 'video' && kind !== 'photo' && kind !== 'unknown') {
    return false;
  }
  if (
    typeof value.path !== 'string' ||
    typeof value.basename !== 'string' ||
    typeof value.hasAutomaticDateOk !== 'boolean'
  ) {
    return false;
  }
  if (
    value.suggestedCandidateId !== null &&
    typeof value.suggestedCandidateId !== 'string'
  ) {
    return false;
  }
  if (!Array.isArray(value.candidates)) return false;
  return value.candidates.every(isMediaDateCandidate);
}

/**
 * Parses stdout from `pb fix-dates inspect` into a result or structured error.
 */
export function parseMediaDateInspectStdout(
  stdout: string,
):
  | { readonly ok: true; readonly data: MediaDateInspectResult }
  | { readonly ok: false; readonly detail: string } {
  const trimmed = stdout.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, detail: 'Inspect output was not valid JSON.' };
  }

  if (isRecord(parsed) && typeof parsed.error === 'string') {
    const err = parsed as MediaDateInspectError;
    const msg = err.message ?? err.error;
    const suffix = err.path ? ` (${err.path})` : '';
    return { ok: false, detail: `${msg}${suffix}` };
  }

  if (isInspectSuccess(parsed)) {
    return { ok: true, data: parsed };
  }

  return { ok: false, detail: 'Inspect output was missing required fields.' };
}
