import { createFileRoute } from '@tanstack/react-router';
import { open } from '@tauri-apps/plugin-dialog';
import {
  IconFolder,
  IconPhoto,
  IconSearch,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { GalleryScanFilePayload } from '@cli-protocol';
import DayTimeline from '@/components/gallery/day-timeline';
import MediaPreviewSheet from '@/components/gallery/media-preview-sheet';
import { Button } from '@/components/ui/button';
import { useRegisterPageHeaderActions } from '@/hooks/use-register-page-header-actions';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { useGalleryScan } from '@/hooks/use-gallery-scan';
import { ALL_EXTENSIONS } from '@/lib/constants';
import { findDirectoryPath } from '@/lib/path';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/browse')({
  staticData: {
    pageTitle: 'Browse by Day',
    pageDescription:
      'View photos and videos in capture-date order, grouped by day.',
  },
  component: BrowsePage,
});

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

function BrowsePage() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<GalleryScanFilePayload | null>(
    null,
  );
  const { result, progress, isScanning, error, scanDirectory, reset } =
    useGalleryScan();

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Media Folder',
    });
    if (selected && typeof selected === 'string') {
      setFolderPath(selected);
      setPreviewFile(null);
      void scanDirectory(selected);
    }
  }, [scanDirectory]);

  const rescan = useCallback(() => {
    if (!folderPath) return;
    setPreviewFile(null);
    void scanDirectory(folderPath);
  }, [folderPath, scanDirectory]);

  const clearFolder = useCallback(() => {
    setFolderPath(null);
    setPreviewFile(null);
    reset();
  }, [reset]);

  const headerActions = useMemo(
    () =>
      folderPath ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          disabled={isScanning}
          onClick={rescan}
        >
          {isScanning ? (
            <IconLoader2 size={16} className="animate-spin" />
          ) : (
            <IconSearch size={16} />
          )}
          Rescan
        </Button>
      ) : null,
    [folderPath, isScanning, rescan],
  );
  useRegisterPageHeaderActions(headerActions);

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      void (async () => {
        const directory = await findDirectoryPath(paths);
        if (!directory) {
          toast.error('Drop a folder to browse by day.');
          return;
        }
        setFolderPath(directory);
        setPreviewFile(null);
        void scanDirectory(directory);
      })();
    },
  });

  const progressLabel =
    progress && progress.total > 0
      ? `Reading dates… ${progress.done} / ${progress.total}`
      : 'Reading dates…';

  return (
    <>
      <MediaPreviewSheet
        file={previewFile}
        onClose={() => {
          setPreviewFile(null);
        }}
      />

      {!folderPath ? (
        <div
          className={cn(
            'mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 text-center transition-colors duration-200',
            isDragging
              ? 'border-primary bg-primary/10'
              : 'border-border/60 bg-muted/20',
          )}
        >
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <IconPhoto size={32} className="text-primary" />
          </div>
          <h2 className="mb-1 text-lg font-semibold tracking-tight">
            Browse photos by day
          </h2>
          <p className="mb-6 max-w-sm text-sm text-muted-foreground">
            Pick a folder (for example a month after split). Files stay on disk
            — this only reads metadata and shows a timeline sorted by capture
            date.
          </p>
          <Button
            type="button"
            onClick={() => {
              void selectFolder();
            }}
            className="gap-2"
          >
            <IconFolder />
            Select Folder
          </Button>
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col gap-4">
          <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <IconFolder size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {basenameOf(folderPath)}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {isScanning
                    ? progressLabel
                    : result
                      ? `${result.totalFiles} files · ${result.days.length} day${
                          result.days.length === 1 ? '' : 's'
                        }`
                      : folderPath}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFolder}
              disabled={isScanning}
              className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              aria-label="Clear folder"
            >
              <IconX size={16} />
            </Button>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            {isScanning && !result ? (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                <IconLoader2 size={32} className="animate-spin" />
                <p className="text-sm">{progressLabel}</p>
              </div>
            ) : result && result.days.length > 0 ? (
              <DayTimeline
                days={result.days}
                onSelectFile={(file) => {
                  setPreviewFile(file);
                }}
              />
            ) : result ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No media files found in this folder.
              </p>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
