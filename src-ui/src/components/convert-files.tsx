import { Clock, File, Play, Spinner, X } from '@phosphor-icons/react';
import { useMediaStore } from '@/stores/media-store';
import { usePixel } from '@/hooks/use-pixel';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import ActivityStatsPanel from './activity-stats-panel';

interface ConvertFilesProps {
  runMode: 'in-app' | 'terminal';
  setRunMode: React.Dispatch<React.SetStateAction<'in-app' | 'terminal'>>;
}

const ConvertFiles: React.FC<ConvertFilesProps> = ({ runMode, setRunMode }) => {
  const { selectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();

  return (
    <>
      {/* Selected files bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <File size={16} weight="duotone" className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {selectedPaths.length} item
              {selectedPaths.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedPaths[0]?.split('/').pop()}
              {selectedPaths.length > 1
                ? ` and ${selectedPaths.length - 1} more`
                : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSelection}
          className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0"
          aria-label="Clear selection"
        >
          <X size={16} weight="bold" />
        </Button>
      </div>

      {/* Global Run Mode Toggle */}
      {pixel.terminalReady && pixel.terminalName && (
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium">Run Mode</span>
          <Tabs
            value={runMode}
            onValueChange={(val) => setRunMode(val as 'in-app' | 'terminal')}
          >
            <TabsList>
              <TabsTrigger value="in-app">In-App</TabsTrigger>
              <TabsTrigger value="terminal">Terminal</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Convert */}
        <button
          onClick={() =>
            runMode === 'in-app'
              ? pixel.convert(selectedPaths)
              : pixel.convertInTerminal(selectedPaths)
          }
          disabled={pixel.isRunning || runMode === 'terminal'}
          className={cn(
            'group flex items-center gap-4 rounded-xl border p-4 text-left transition-colors duration-150',
            'hover:border-primary/50 hover:bg-primary/5',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-colors duration-200',
              pixel.isRunning
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-primary/10 text-primary group-hover:bg-primary/20',
            )}
          >
            {pixel.isRunning ? (
              <Spinner size={20} className="animate-spin" />
            ) : (
              <Play size={20} weight="fill" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">
              {pixel.isRunning ? 'Converting…' : 'Convert Media'}
            </p>
            <p className="text-xs text-muted-foreground">
              {pixel.isRunning
                ? 'Processing your files…'
                : 'Make compatible with Pixel'}
            </p>
          </div>
        </button>

        {/* Fix Dates */}
        <button
          onClick={() =>
            runMode === 'in-app'
              ? pixel.fixDates(selectedPaths)
              : pixel.fixDatesInTerminal(selectedPaths)
          }
          disabled={pixel.isRunning || runMode === 'terminal'}
          className={cn(
            'group flex items-center gap-4 rounded-xl border p-4 text-left transition-colors duration-150',
            'hover:border-foreground/20 hover:bg-muted/50',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-muted-foreground shrink-0 transition-colors duration-200 group-hover:bg-muted/80">
            <Clock size={20} weight="duotone" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Fix Dates</p>
            <p className="text-xs text-muted-foreground">
              Restore EXIF or Takeout timestamps
            </p>
          </div>
        </button>
      </div>

      {runMode === 'in-app' ? <ActivityStatsPanel /> : null}
    </>
  );
};

export default ConvertFiles;
