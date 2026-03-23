import { Clock, File, Play, Spinner, X } from '@phosphor-icons/react';
import { useMediaStore } from '@/stores/media-store';
import { usePixel } from '@/hooks/use-pixel';
import { Button } from '@/components/ui/button';
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

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          title="Make compatible with Pixel"
          onClick={() =>
            runMode === 'in-app'
              ? pixel.convert(selectedPaths)
              : pixel.convertInTerminal(selectedPaths)
          }
          disabled={pixel.isRunning || runMode === 'terminal'}
          className="w-full gap-2 sm:flex-1"
        >
          {pixel.isRunning ? (
            <Spinner size={18} className="animate-spin" />
          ) : (
            <Play size={18} weight="fill" />
          )}
          {pixel.isRunning ? 'Converting…' : 'Convert Media'}
        </Button>
        <Button
          type="button"
          variant="outline"
          title="Restore EXIF or Takeout timestamps"
          onClick={() =>
            runMode === 'in-app'
              ? pixel.fixDates(selectedPaths)
              : pixel.fixDatesInTerminal(selectedPaths)
          }
          disabled={pixel.isRunning || runMode === 'terminal'}
          className="w-full gap-2 sm:flex-1"
        >
          <Clock size={18} weight="duotone" />
          Fix Dates
        </Button>
      </div>

      {runMode === 'in-app' ? <ActivityStatsPanel /> : null}
    </>
  );
};

export default ConvertFiles;
