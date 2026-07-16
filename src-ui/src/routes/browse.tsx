import { createFileRoute } from '@tanstack/react-router';
import { open } from '@tauri-apps/plugin-dialog';
import {
  IconFolder,
  IconLoader2,
  IconPhoto,
  IconSearch,
  IconX,
} from '@tabler/icons-react';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { GalleryScanFilePayload } from '@cli-protocol';
import DayTreeTable from '@/components/gallery/day-tree-table';
import Lightbox from '@/components/gallery/lightbox';
import MediaPreview from '@/components/gallery/media-preview';
import { Button } from '@/components/ui/button';
import { useRegisterPageHeaderActions } from '@/hooks/use-register-page-header-actions';
import { useIsSplitView } from '@/hooks/use-is-split-view';
import { formatGalleryCaptureTime } from '@/lib/gallery-scan';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { useGalleryScan } from '@/hooks/use-gallery-scan';
import { ALL_EXTENSIONS } from '@/lib/constants';
import { findDirectoryPath } from '@/lib/path';
import SplitColumn from '@/components/ui/split-column';
import SelectFiles from '@/components/select-files';

export const Route = createFileRoute('/browse')({
  staticData: {
    pageTitle: 'Browse Media',
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
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [removedPaths, setRemovedPaths] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const { containerRef, isSplitView } = useIsSplitView();
  const { result, progress, isScanning, error, scanDirectory, reset } =
    useGalleryScan();

  // When the page container has room, the second column previews inline;
  // otherwise open the Lightbox dialog. Either way the row click selects it.
  const handleSelectFile = useCallback(
    (file: GalleryScanFilePayload) => {
      setPreviewFile(file);
      if (!isSplitView) {
        setLightboxOpen(true);
      }
    },
    [isSplitView],
  );

  const handleTrashed = useCallback((path: string) => {
    setRemovedPaths((prev) => new Set(prev).add(path));
    setPreviewFile((current) => (current?.path === path ? null : current));
  }, []);

  const visibleDays = useMemo(() => {
    if (!result) return [];
    if (removedPaths.size === 0) return result.days;
    return result.days
      .map((day) => ({
        ...day,
        files: day.files.filter((file) => !removedPaths.has(file.path)),
      }))
      .filter((day) => day.files.length > 0);
  }, [result, removedPaths]);

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Media Folder',
    });
    if (selected && typeof selected === 'string') {
      setFolderPath(selected);
      setPreviewFile(null);
      setLightboxOpen(false);
      setRemovedPaths(new Set());
      void scanDirectory(selected);
    }
  }, [scanDirectory]);

  const rescan = useCallback(() => {
    if (!folderPath) return;
    setPreviewFile(null);
    setLightboxOpen(false);
    setRemovedPaths(new Set());
    void scanDirectory(folderPath);
  }, [folderPath, scanDirectory]);

  const clearFolder = useCallback(() => {
    setFolderPath(null);
    setPreviewFile(null);
    setLightboxOpen(false);
    setRemovedPaths(new Set());
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
        setLightboxOpen(false);
        setRemovedPaths(new Set());
        void scanDirectory(directory);
      })();
    },
  });

  const progressLabel =
    progress && progress.total > 0
      ? `Reading dates… ${progress.done} / ${progress.total}`
      : 'Reading dates…';

  if (!folderPath) {
    return (
      <SelectFiles
        icon={<IconPhoto size={32} className="text-primary" />}
        title="No folder selected"
        description="Pick a folder (for example a month after split). Files stay on disk —
            this only reads metadata and shows a timeline sorted by capture date."
        isDragging={isDragging}
        onClickFolder={() => void selectFolder()}
        disabled={isScanning}
      />
    );
  }

  return (
    <SplitColumn containerRef={containerRef} fillHeight>
      <Lightbox
        file={previewFile}
        open={lightboxOpen}
        onClose={() => {
          setLightboxOpen(false);
        }}
        onTrashed={handleTrashed}
      />

      <div className="flex min-h-0 min-w-0 flex-col gap-4">
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
          ) : result && visibleDays.length > 0 ? (
            <DayTreeTable days={visibleDays} onSelectFile={handleSelectFile} />
          ) : result ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No media files found in this folder.
            </p>
          ) : null}
        </div>
      </div>

      {/* Inline preview — fills the second column when its container has room. */}
      <aside className="hidden min-h-0 min-w-0 flex-col gap-3 @min-[64rem]/split:flex">
        {previewFile ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {previewFile.basename}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {(() => {
                  const t = formatGalleryCaptureTime(previewFile.unixSeconds);
                  return t ? `Captured ${t} UTC` : previewFile.path;
                })()}
              </p>
            </div>
            <MediaPreview
              key={previewFile.path}
              file={previewFile}
              onTrashed={handleTrashed}
              onExpand={() => {
                setLightboxOpen(true);
              }}
              mediaClassName="flex-1 @min-[64rem]/split:max-h-[calc(100vh-16rem)]"
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Select a file to preview it here.
          </div>
        )}
      </aside>
    </SplitColumn>
  );
}
