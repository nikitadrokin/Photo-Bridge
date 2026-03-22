import { useCallback, useMemo, useRef } from 'react';
import { ListBullets, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ScrollArea from '@/components/ui/scroll-area';
import { usePixel } from '@/contexts/pixel-context';
import { useUiStore } from '@/stores/ui-store';
import type { CliUiEventV1 } from '@cli-protocol';

interface ActivityFeedProps {
  emptyMessage?: string;
}

function verbForCommand(command: 'convert' | 'copy'): string {
  return command === 'copy' ? 'Copy' : 'Convert';
}

/**
 * Maps one CLI UI event to a short user-facing line (no sidecar prose).
 */
function formatActivityLine(event: CliUiEventV1): {
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
      const parts: string[] = ['Done'];
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
    case 'progress':
      return null;
    default:
      return null;
  }
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  emptyMessage = 'Activity will appear here…',
}) => {
  const {
    activityEvents,
    logs,
    logsEndRef,
    clearLogs,
  } = usePixel();

  const { logViewerHeight, setLogViewerHeight } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const lastProgress = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const e = activityEvents[i];
      if (e.kind === 'progress') return e;
    }
    return null;
  }, [activityEvents]);

  const visibleRows = useMemo(() => {
    const rows: Array<{ key: string; tone: string; text: string }> = [];
    activityEvents.forEach((event, i) => {
      if (event.kind === 'progress') return;
      const formatted = formatActivityLine(event);
      if (!formatted) return;
      rows.push({
        key: `${i}-${event.kind}`,
        tone: formatted.tone,
        text: formatted.text,
      });
    });
    return rows;
  }, [activityEvents]);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = containerRef.current?.offsetHeight ?? logViewerHeight;

      const onMouseMove = (ev: MouseEvent) => {
        const delta = ev.clientY - startY;
        setLogViewerHeight(startHeight + delta);
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.body.style.cursor = 'nwse-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [logViewerHeight, setLogViewerHeight],
  );

  const hasContent =
    visibleRows.length > 0 || logs.length > 0 || lastProgress != null;

  return (
    <div className="flex flex-col shrink-0">
      <div
        ref={containerRef}
        style={{ height: logViewerHeight }}
        className="relative flex flex-col min-h-0 rounded-xl border bg-card overflow-hidden"
      >
        <header className="flex items-center justify-between px-4 py-2.5 border-b bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            <ListBullets size={16} className="text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-muted-foreground">
              Activity
            </span>
            {lastProgress != null && lastProgress.total > 0 ? (
              <span className="text-xs text-muted-foreground tabular-nums">
                {lastProgress.done}/{lastProgress.total}
              </span>
            ) : null}
          </div>
          {hasContent ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearLogs}
              className="h-6 text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash size={12} />
              Clear
            </Button>
          ) : null}
        </header>

        <ScrollArea
          className="grow p-4 text-sm leading-relaxed"
          gradientHeightTop="0"
          gradientHeightBottom="0"
        >
          {!hasContent ? (
            <span className="text-muted-foreground/60">{emptyMessage}</span>
          ) : null}

          {lastProgress != null && lastProgress.total > 0 ? (
            <div className="mb-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-[width] duration-300 ease-out"
                style={{
                  width: `${Math.min(100, Math.round((lastProgress.done / lastProgress.total) * 100))}%`,
                }}
              />
            </div>
          ) : null}

          <ul className="space-y-2">
            {visibleRows.map((row) => (
              <li
                key={row.key}
                className={cn(
                  row.tone === 'success' && 'text-emerald-600 dark:text-emerald-400',
                  row.tone === 'warn' && 'text-amber-600 dark:text-amber-400',
                  row.tone === 'error' && 'text-destructive',
                  row.tone === 'muted' && 'text-muted-foreground',
                  row.tone === 'default' && 'text-foreground',
                )}
              >
                {row.text}
              </li>
            ))}
          </ul>

          {logs.length > 0 ? (
            <div className="mt-4 pt-4 border-t border-border/60">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Details
              </p>
              <div className="font-mono text-xs text-muted-foreground space-y-0.5">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      log.type === 'error' && 'text-destructive',
                      log.type === 'warn' && 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {log.message}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <div ref={logsEndRef} />
        </ScrollArea>

        <div
          onMouseDown={handleDragStart}
          className="group absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize select-none z-10 flex items-center justify-center"
          title="Drag to resize"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors duration-150"
          >
            <line
              x1="9"
              y1="1"
              x2="1"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <line
              x1="9"
              y1="5"
              x2="5"
              y2="9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
};

export default ActivityFeed;
