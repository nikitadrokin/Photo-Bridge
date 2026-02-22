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
  Terminal,
  UploadSimple,
  X,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import DropzoneOverlay from '@/components/dropzone-overlay';
import LogViewer from '@/components/log-viewer';
import { PageHeader } from '@/components/page-header';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/contexts/pixel-context';
import {
  ALL_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from '@/lib/constants';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/convert')({ component: ConvertPage });

function ConvertPage() {
  const [selectedPaths, setSelectedPaths] = useState<Array<string>>([]);
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
  }, [pixel]);

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
  }, [pixel]);

  const clearSelection = useCallback(() => setSelectedPaths([]), []);

  return (
    <>
      <DropzoneOverlay isVisible={isDragging} extensions={ALL_EXTENSIONS} />

      <PageHeader
        title="Convert Media"
        description="Convert photos and videos for Pixel compatibility"
      />

      <main className="flex-1 overflow-auto px-6 pb-6">
        <div className="mx-auto flex flex-col max-w-3xl h-full gap-6">
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

              {/* Action buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Convert */}
                <button
                  onClick={() => pixel.convert(selectedPaths)}
                  disabled={pixel.isRunning}
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
                  onClick={() => pixel.fixDates(selectedPaths)}
                  disabled={pixel.isRunning}
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

              {/* Terminal buttons (secondary) */}
              {pixel.terminalReady && pixel.terminalName ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Run in terminal:
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pixel.convertInTerminal(selectedPaths)}
                    disabled={pixel.isRunning}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Terminal size={12} />
                    Convert
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => pixel.fixDatesInTerminal(selectedPaths)}
                    disabled={pixel.isRunning}
                    className="h-7 text-xs gap-1.5"
                  >
                    <Terminal size={12} />
                    Fix Dates
                  </Button>
                </div>
              ) : null}
            </>
          )}

          {/* Log Viewer */}
          <LogViewer emptyMessage="Output will appear here after conversion" />
        </div>
      </main>
    </>
  );
}
