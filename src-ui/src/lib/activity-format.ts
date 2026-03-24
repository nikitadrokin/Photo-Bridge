import type { EventV1 } from '@cli-protocol';

export function verbForCommand(command: 'convert' | 'copy'): string {
  return command === 'copy' ? 'Copy' : 'Convert';
}

/** Numbers for the summary cards — live from file events until `session` end arrives. */
export function deriveActivityStats(events: Array<EventV1>): {
  total: number | null;
  added: number;
  skipped: number;
  failed: number;
  subtitle: string | null;
} {
  let sessionStartTotal: number | null = null;
  let startIndex = -1;
  let endProcessed = 0;
  let endSkipped = 0;
  let endFailed = 0;
  let endTotal: number | null = null;
  let finalized = false;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.kind === 'session') {
      if (e.phase === 'start') {
        sessionStartTotal = e.total ?? null;
        startIndex = i;
      } else {
        finalized = true;
        endProcessed = e.processed ?? 0;
        endSkipped = e.skipped ?? 0;
        endFailed = e.failed ?? 0;
        endTotal = e.total ?? null;
      }
    }
  }

  let liveAdded = 0;
  let liveSkipped = 0;
  let liveFailed = 0;
  const from = startIndex >= 0 ? startIndex + 1 : 0;
  for (let i = from; i < events.length; i++) {
    const e = events[i];
    if (e.kind === 'file') {
      if (e.status === 'done') liveAdded++;
      else if (e.status === 'skipped') liveSkipped++;
      else liveFailed++;
    }
  }

  let lastProgressTotal: number | null = null;
  for (let i = events.length - 1; i >= 0; i--) {
    const pe = events[i];
    if (pe.kind === 'progress') {
      lastProgressTotal = pe.total;
      break;
    }
  }

  const added = finalized ? endProcessed : liveAdded;
  const skipped = finalized ? endSkipped : liveSkipped;
  const failed = finalized ? endFailed : liveFailed;

  const total =
    finalized && endTotal != null
      ? endTotal
      : (sessionStartTotal ?? lastProgressTotal ?? null);

  let subtitle: string | null = null;
  if (startIndex >= 0) {
    const startEv = events[startIndex];
    if (startEv.kind === 'session' && startEv.phase === 'start') {
      const v = verbForCommand(startEv.command);
      if (startEv.layout === 'directory' && startEv.outputDir) {
        subtitle = `${v}ing folder · ${startEv.total ?? 0} files`;
      } else {
        subtitle = `${v}ing ${startEv.total ?? 0} file${(startEv.total ?? 0) === 1 ? '' : 's'}`;
      }
    }
  }

  return {
    total,
    added,
    skipped,
    failed,
    subtitle,
  };
}

export function formatActivityLine(event: EventV1): {
  tone: 'default' | 'success' | 'warn' | 'error' | 'muted';
  text: string;
} | null {
  switch (event.kind) {
    case 'session': {
      if (event.phase === 'start') {
        const v = verbForCommand(event.command);
        if (event.layout === 'directory' && event.outputDir) {
          return {
            tone: 'default',
            text: `${v}ing folder (${event.total ?? 0} files)`,
          };
        }
        return {
          tone: 'default',
          text: `${v}ing ${event.total ?? 0} file${(event.total ?? 0) === 1 ? '' : 's'}`,
        };
      }
      const parts: Array<string> = ['Done'];
      if (event.processed != null) {
        parts.push(`${event.processed} added`);
      }
      if (event.skipped != null && event.skipped > 0) {
        parts.push(`${event.skipped} skipped`);
      }
      if (event.failed != null && event.failed > 0) {
        parts.push(`${event.failed} failed`);
      }
      return { tone: 'success', text: parts.join(' · ') };
    }
    case 'file': {
      const label = event.name ?? 'file';
      if (event.status === 'done') {
        if (event.media === 'image') {
          return {
            tone: 'default',
            text: `+1 photo · .${event.extIn}`,
          };
        }
        if (event.media === 'legacy_video') {
          return {
            tone: 'default',
            text: `+1 video (transcoded) · .${event.extIn} → .${event.extOut}`,
          };
        }
        return {
          tone: 'default',
          text: `+1 video · .${event.extIn} → .${event.extOut}`,
        };
      }
      if (event.status === 'skipped') {
        const reason =
          event.reason === 'output_exists'
            ? 'already exists'
            : event.reason === 'output_same_as_input'
              ? 'same as output'
              : event.reason === 'unreadable_video'
                ? 'unreadable'
                : 'skipped';
        return {
          tone: 'muted',
          text: `Skipped ${label} (${reason})`,
        };
      }
      return {
        tone: 'error',
        text: `Failed ${label}`,
      };
    }
    case 'blocked': {
      if (event.code === 'missing_tools') {
        const t = event.tools?.length
          ? event.tools.join(', ')
          : 'required tools';
        return {
          tone: 'error',
          text: `Missing: ${t}. Install FFmpeg and ExifTool (e.g. brew install ffmpeg exiftool).`,
        };
      }
      return { tone: 'error', text: `Blocked: ${event.code}` };
    }
    case 'warn': {
      if (event.code === 'date_not_recovered') {
        return {
          tone: 'warn',
          text: `Date not recovered${event.detail ? ` · ${event.detail}` : ''}`,
        };
      }
      return {
        tone: 'warn',
        text: event.detail ?? event.code,
      };
    }
    case 'error': {
      return {
        tone: 'error',
        text: event.detail ?? event.code,
      };
    }
    case 'info':
      return { tone: 'muted', text: event.message };
    case 'success':
      return { tone: 'success', text: event.message };
    case 'log':
      return { tone: 'default', text: event.message };
    case 'progress':
      return null;
    case 'push_bytes':
    case 'pull_bytes':
      return null;
    default:
      return null;
  }
}

export type ActivityRow = { key: string; tone: string; text: string };

/** Rows for the Summary panel (session + file lines only; no warn/error/blocked banners). */
export function buildDetailRows(events: Array<EventV1>): Array<ActivityRow> {
  const rows: Array<ActivityRow> = [];
  events.forEach((event, i) => {
    if (
      event.kind === 'progress' ||
      event.kind === 'push_bytes' ||
      event.kind === 'pull_bytes'
    ) {
      return;
    }
    if (
      event.kind === 'warn' ||
      event.kind === 'error' ||
      event.kind === 'blocked'
    ) {
      return;
    }
    const formatted = formatActivityLine(event);
    if (!formatted) return;
    rows.push({
      key: `${i}-${event.kind}`,
      tone: formatted.tone,
      text: formatted.text,
    });
  });
  return rows;
}

/** Banner rows shown in the left stats panel. */
export function buildAlertRows(events: Array<EventV1>): Array<ActivityRow> {
  const rows: Array<ActivityRow> = [];
  events.forEach((event, i) => {
    if (
      event.kind !== 'warn' &&
      event.kind !== 'error' &&
      event.kind !== 'blocked'
    ) {
      return;
    }
    const formatted = formatActivityLine(event);
    if (!formatted) return;
    rows.push({
      key: `${i}-${event.kind}`,
      tone: formatted.tone,
      text: formatted.text,
    });
  });
  return rows;
}
