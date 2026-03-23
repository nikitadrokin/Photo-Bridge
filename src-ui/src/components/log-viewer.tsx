import { useCallback, useRef } from 'react';
import { ArrowRight, Terminal, Trash } from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ScrollArea from '@/components/ui/scroll-area';
import { usePixel } from '@/hooks/use-pixel';
import { useUiStore } from '@/stores/ui-store';

interface LogViewerProps {
  emptyMessage?: string;
}

/** Truncate a path to show only the last N segments and shorten long filenames */
const truncatePath = (path: string, segments: number = 2): string => {
  const parts = path.split('/');
  const lastIdx = parts.length - 1;
  const filename = parts[lastIdx];

  if (filename.length > 16) {
    parts[lastIdx] = `${filename.slice(0, 7)}…${filename.slice(-7)}`;
  }

  if (parts.length <= segments) return parts.join('/');
  return '…/' + parts.slice(-segments).join('/');
};

const LogViewer: React.FC<LogViewerProps> = ({
  emptyMessage = 'Logs will appear here…',
}) => {
  const {
    logs,
    transferPaths,
    openActiveInTerminal,
    terminalName,
    clearLogs,
  } = usePixel();

  const { logViewerHeight, setLogViewerHeight } = useUiStore();
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex flex-col shrink-0">
      <div
        ref={containerRef}
        style={{ height: logViewerHeight }}
        className="relative flex flex-col min-h-0 rounded-xl border bg-[oklch(0.13_0_0)] dark:bg-[oklch(0.10_0_0)] overflow-hidden"
      >
        {/* Toolbar */}
        <header className="flex items-center justify-between px-4 py-2.5 border-b border-white/6 bg-[oklch(0.16_0_0)] dark:bg-[oklch(0.12_0_0)]">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Traffic light dots */}
            <div className="flex items-center gap-1.5 mr-2">
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/10" />
            </div>
            {transferPaths ? (
              <div className="flex items-center gap-2 text-xs font-mono text-white/40 min-w-0">
                <span className="truncate min-w-0" title={transferPaths.source}>
                  {truncatePath(transferPaths.source)}
                </span>
                <ArrowRight size={10} className="shrink-0 text-white/20" />
                <span
                  className="truncate min-w-0"
                  title={transferPaths.destination}
                >
                  {truncatePath(transferPaths.destination)}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs font-medium text-white/50">
                <Terminal size={14} />
                <span>Output</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {terminalName ? (
              <Button
                variant="ghost"
                size="sm"
                // onClick={openActiveInTerminal}
                onClick={() =>
                  alert(
                    'This is bugged right now. The code says "openActiveInTerminal", which confuses agents into thinking this is a generic function. The function is hardcoded to make one action, and we need to update that function to be generic. Until then, this button shows future behavior, not what I have right now.',
                  )
                }
                className="h-6 text-xs text-white/40 hover:text-white/70 hover:bg-white/5"
              >
                <Terminal size={12} />
                {terminalName}
              </Button>
            ) : null}

            {logs.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearLogs}
                className="h-6 text-xs text-white/40 hover:text-red-400 hover:bg-white/5 transition-colors duration-200"
              >
                <Trash size={12} />
                Clear
              </Button>
            ) : null}
          </div>
        </header>

        {/* Log content */}
        <ScrollArea
          className="grow p-4 font-mono text-[13px] leading-relaxed"
          gradientHeightTop="0"
          gradientHeightBottom="0"
        >
          {logs.length === 0 ? (
            <span className="text-white/25">{emptyMessage}</span>
          ) : null}
          {logs.map((log, i) => (
            <div
              key={i}
              className={cn(
                'mb-0.5',
                log.type === 'info' && 'text-blue-400',
                log.type === 'success' && 'text-emerald-400',
                log.type === 'error' && 'text-red-400',
                log.type === 'warn' && 'text-yellow-400',
                log.type === 'log' && 'text-white/50',
              )}
            >
              {log.message}
            </div>
          ))}
        </ScrollArea>

        {/* Resize grip — bottom-right corner */}
        <div
          onMouseDown={handleDragStart}
          className="group absolute bottom-0 right-0 h-5 w-5 cursor-nwse-resize select-none z-10 flex items-center justify-center"
          title="Drag to resize"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className="text-white/20 group-hover:text-white/50 transition-colors duration-150"
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

export default LogViewer;
