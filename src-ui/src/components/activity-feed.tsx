import { useCallback, useMemo, useRef, useState } from 'react';
import {
  CaretDown,
  CaretRight,
  ListBullets,
  Trash,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { buildDetailRows } from '@/lib/activity-format';
import { cn } from '@/lib/utils';
import ScrollArea from '@/components/ui/scroll-area';
import { usePixel } from '@/contexts/pixel-context';
import { useUiStore } from '@/stores/ui-store';

interface ActivityFeedProps {
  emptyMessage?: string;
}

const ActivityFeed: React.FC<ActivityFeedProps> = ({
  emptyMessage = 'Activity will appear here…',
}) => {
  const { activityEvents, logs, logsEndRef, clearLogs } = usePixel();

  const [showDetails, setShowDetails] = useState(true);

  const { logViewerHeight, setLogViewerHeight } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);

  const detailRows = useMemo(
    () => buildDetailRows(activityEvents),
    [activityEvents],
  );

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

  const hasContent = detailRows.length > 0 || logs.length > 0;

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
              Summary
            </span>
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

          {detailRows.length > 0 ? (
            <div className="border-border/60">
              <button
                type="button"
                onClick={() => setShowDetails((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left mb-2"
              >
                {showDetails ? (
                  <CaretDown size={14} className="shrink-0" />
                ) : (
                  <CaretRight size={14} className="shrink-0" />
                )}
                <ListBullets size={14} className="shrink-0" />
                Per-file log
                <span className="text-muted-foreground/70 font-normal">
                  ({detailRows.length})
                </span>
              </button>
              {showDetails ? (
                <ul className="space-y-1.5 pl-1">
                  {detailRows.map((row) => (
                    <li
                      key={row.key}
                      className={cn(
                        'text-xs',
                        row.tone === 'success' &&
                          'text-emerald-600 dark:text-emerald-400',
                        row.tone === 'warn' &&
                          'text-amber-600 dark:text-amber-400',
                        row.tone === 'error' && 'text-destructive',
                        row.tone === 'muted' && 'text-muted-foreground',
                        row.tone === 'default' && 'text-foreground/90',
                      )}
                    >
                      {row.text}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {logs.length > 0 ? (
            <div
              className={cn(
                'border-t border-border/60 pt-4',
                detailRows.length > 0 && 'mt-4',
              )}
            >
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <WarningCircle size={14} />
                Technical details
              </p>
              <div className="font-mono text-xs text-muted-foreground space-y-0.5">
                {logs.map((log, i) => (
                  <div
                    key={i}
                    className={cn(
                      log.type === 'error' && 'text-destructive',
                      log.type === 'warn' &&
                        'text-amber-600 dark:text-amber-400',
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
