import { useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { open } from '@tauri-apps/plugin-dialog';
import {
  Clock,
  File,
  Folder,
  Images,
  Play,
  Spinner,
  Terminal,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
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
import { useMediaStore } from '@/stores/media-store';

export const Route = createFileRoute('/copy')({
  staticData: { pageTitle: 'Copy Media' },
  component: ConvertPage,
});

function ConvertPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
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

      <main className="flex-1 px-6 py-6">
        <div className="mx-auto flex flex-col max-w-3xl gap-6">
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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  title="Copy/rename for Pixel upload"
                  onClick={() => pixel.copy(selectedPaths)}
                  disabled={pixel.isRunning}
                  className="w-full gap-2 sm:flex-1"
                >
                  {pixel.isRunning ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <Play size={18} weight="fill" />
                  )}
                  {pixel.isRunning ? 'Copying…' : 'Copy Media'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  title="Restore EXIF or Takeout timestamps"
                  onClick={() => pixel.fixDates(selectedPaths)}
                  disabled={pixel.isRunning}
                  className="w-full gap-2 sm:flex-1"
                >
                  <Clock size={18} weight="duotone" />
                  Fix Dates
                </Button>
              </div>

              <ActivityStatsPanel />

              {/* Terminal buttons (secondary) */}
              {pixel.terminalReady && pixel.terminalName ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Run in terminal:
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pixel.copyInTerminal(selectedPaths)}
                    // disabled={pixel.isRunning}
                    disabled
                    className="h-7 text-xs gap-1.5"
                  >
                    <Terminal size={12} />
                    Convert
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pixel.fixDatesInTerminal(selectedPaths)}
                    // disabled={pixel.isRunning}
                    disabled
                    className="h-7 text-xs gap-1.5"
                  >
                    <Terminal size={12} />
                    Fix Dates
                  </Button>
                </div>
              ) : null}
            </>
          )}

          <ActivityFeed emptyMessage="Activity will appear here after copy" />
        </div>
      </main>
    </>
  );
}
