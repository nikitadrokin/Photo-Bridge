import { useCallback, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Clock,
  File,
  Folder,
  Images,
  Play,
  Spinner,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DropzoneOverlay from '@/components/dropzone-overlay';
import ActivityFeed from '@/components/activity-feed';
import ActivityStatsPanel from '@/components/activity-stats-panel';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import {
  ALL_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useMediaStore } from '@/stores/media-store';

export const Route = createFileRoute('/convert')({
  staticData: { pageTitle: 'Convert Media' },
  component: ConvertPage,
});

function ConvertPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
  const [runMode, setRunMode] = useState<'in-app' | 'terminal'>('in-app');
  const pixel = usePixel();

  const hasSelection = selectedPaths.length > 0;

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      setSelectedPaths(paths);
      pixel.clearLogs();
    },
  });

  const selectFiles = useCallback(async () => {
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [
        {
          name: 'Media',
          extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
      title: 'Select Photos/Videos',
    });
    if (selected) {
      setSelectedPaths(Array.isArray(selected) ? selected : [selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Directory',
    });
    if (selected && typeof selected === 'string') {
      setSelectedPaths([selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  return (
    <>
      <DropzoneOverlay isVisible={isDragging} extensions={ALL_EXTENSIONS} />

      <main className="flex-1 p-2">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8">
          {/* LEFT PANEL: Controls */}
          <div className="flex flex-col gap-6">
            {/* Empty state / File selection */}
            {!hasSelection ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-16 px-8 text-center transition-colors duration-200 hover:border-border hover:bg-muted/30">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                  <Images size={32} weight="duotone" className="text-primary" />
                </div>
                <h2 className="text-lg font-semibold tracking-tight mb-1">
                  No files selected
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Drag and drop files here, or use the buttons below to select
                  media for conversion.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={selectFolder}
                    disabled={pixel.isRunning}
                    className="gap-2"
                  >
                    <Folder weight="duotone" />
                    Select Folder
                  </Button>
                  <Button
                    onClick={selectFiles}
                    disabled={pixel.isRunning}
                    className="gap-2"
                  >
                    <UploadSimple weight="bold" />
                    Select Files
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {/* Selected files bar */}
                <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <File
                        size={16}
                        weight="duotone"
                        className="text-primary"
                      />
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
                      onValueChange={(val) =>
                        setRunMode(val as 'in-app' | 'terminal')
                      }
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
            )}
          </div>

          {/* RIGHT PANEL: Log Viewer / Terminal Message */}
          <div className="flex flex-col min-h-0">
            {runMode === 'terminal' ? (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center rounded-xl border bg-muted/20 text-muted-foreground">
                <div className="text-center space-y-2">
                  <p className="font-medium text-foreground">
                    Commands will open in {pixel.terminalName || 'Terminal'}
                  </p>
                  <p className="text-sm opacity-70">
                    Terminal execution coming soon
                  </p>
                </div>
              </div>
            ) : (
              <ActivityFeed emptyMessage="Activity will appear here after conversion" />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
