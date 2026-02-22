import { ArrowRight, Terminal, Trash } from '@phosphor-icons/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ScrollArea from '@/components/ui/scroll-area';
import { usePixel } from '@/contexts/pixel-context';

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
    logsEndRef,
    transferPaths,
    openActiveInTerminal,
    terminalName,
    clearLogs,
  } = usePixel();

  return (
    <Card className="w-full grow max-w-3xl p-0 relative overflow-hidden rounded-lg shadow-xs gap-0 flex flex-col min-h-0">
      {/* Sticky toolbar */}
      <header className="sticky top-0 z-10 bg-card border-b flex items-center justify-between px-4 py-2 min-h-[40px]">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {transferPaths ? (
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground min-w-0">
              <span className="truncate min-w-0" title={transferPaths.source}>
                {truncatePath(transferPaths.source)}
              </span>
              <ArrowRight
                size={12}
                className="shrink-0 text-muted-foreground/50"
              />
              <span
                className="truncate min-w-0"
                title={transferPaths.destination}
              >
                {truncatePath(transferPaths.destination)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm font-medium">
              <Terminal size={16} className="text-muted-foreground" />
              <span>Terminal Output</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {terminalName ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={openActiveInTerminal}
              className="h-6 text-xs text-muted-foreground"
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
              className="h-6 text-xs text-muted-foreground hover:text-destructive transition-colors duration-200"
            >
              <Trash size={12} />
              Clear
            </Button>
          ) : null}
        </div>
      </header>
      <ScrollArea className="grow p-4 font-mono text-sm before:top-10">
        {logs.length === 0 ? (
          <span className="text-muted-foreground">{emptyMessage}</span>
        ) : null}
        {logs.map((log, i) => (
          <div
            key={i}
            className={cn(
              'mb-1',
              log.type === 'info' && 'text-blue-500',
              log.type === 'success' && 'text-emerald-500',
              log.type === 'error' && 'text-red-500',
              log.type === 'warn' && 'text-yellow-500',
              log.type === 'log' && 'text-muted-foreground',
            )}
          >
            {log.message}
          </div>
        ))}
        <div ref={logsEndRef} />
      </ScrollArea>
    </Card>
  );
};

export default LogViewer;
