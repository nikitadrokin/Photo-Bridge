import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { IconLoader2, IconRefresh, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { PixelFilePayload } from '@cli-protocol';
import { usePixel } from '@/hooks/use-pixel';
import { useIsLargeScreen } from '@/hooks/use-is-large-screen';
import { PIXEL_CAMERA_DIR } from '@/lib/constants';
import { AvailableStorageCard } from '@/components/available-storage-card';
import { ConnectionStatus } from '@/components/connection-status';
import PixelFolderTree from '@/components/gallery/pixel-folder-tree';
import PixelMediaPreview, {
  type PixelPreviewStatus,
} from '@/components/gallery/pixel-media-preview';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export const Route = createFileRoute('/pixel')({
  staticData: {
    pageTitle: 'Pixel Device',
    pageDescription:
      'Browse, manage storage, and purge the camera roll on your connected Pixel.',
  },
  component: PixelPage,
});

interface PreviewState {
  readonly status: PixelPreviewStatus;
  readonly localPath: string | null;
  readonly detail: string | null;
}

function PixelPage() {
  const pixel = usePixel();
  const {
    isConnected,
    listPixelFiles,
    pullPixelFileToCache,
    savePixelFiles,
    purgePixelFiles,
    refreshAvailableStorage,
  } = pixel;

  const isLargeScreen = useIsLargeScreen();

  const [files, setFiles] = useState<PixelFilePayload[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const [selectedFile, setSelectedFile] = useState<PixelFilePayload | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Guards against an earlier pull resolving after a newer selection.
  const previewRequestRef = useRef(0);

  const loadFiles = useCallback(async () => {
    if (!isConnected) return;
    setIsLoading(true);
    const result = await listPixelFiles();
    if (result.ok) {
      setFiles(result.files);
    } else {
      toast.error('Could not list device files', {
        description: result.detail,
      });
    }
    setIsLoading(false);
  }, [isConnected, listPixelFiles]);

  // Load files and storage whenever a device connects.
  useEffect(() => {
    if (isConnected) {
      void loadFiles();
      void refreshAvailableStorage();
    } else {
      setFiles(null);
      setSelectedFile(null);
      setPreview(null);
      setDialogOpen(false);
    }
  }, [isConnected, loadFiles, refreshAvailableStorage]);

  const handleSelectFile = useCallback(
    (file: PixelFilePayload) => {
      setSelectedFile(file);
      if (!isLargeScreen) {
        setDialogOpen(true);
      }

      const requestId = previewRequestRef.current + 1;
      previewRequestRef.current = requestId;
      setPreview({ status: 'loading', localPath: null, detail: null });

      void (async () => {
        const result = await pullPixelFileToCache(file);
        // Ignore if a newer selection superseded this pull.
        if (previewRequestRef.current !== requestId) return;
        if (result.ok) {
          setPreview({
            status: 'ready',
            localPath: result.localPath,
            detail: null,
          });
        } else {
          setPreview({ status: 'error', localPath: null, detail: result.detail });
        }
      })();
    },
    [isLargeScreen, pullPixelFileToCache],
  );

  const handlePurge = useCallback(async () => {
    setIsPurging(true);
    const result = await purgePixelFiles();
    if (result.ok) {
      toast.success(
        `Purged ${result.deleted} file${result.deleted === 1 ? '' : 's'} from the Pixel`,
      );
      setFiles([]);
      setSelectedFile(null);
      setPreview(null);
      void loadFiles();
      void refreshAvailableStorage();
    } else {
      toast.error('Could not purge device files', {
        description: result.detail,
      });
    }
    setIsPurging(false);
    setConfirmPurge(false);
  }, [purgePixelFiles, loadFiles, refreshAvailableStorage]);

  const handleSave = useCallback(() => {
    if (selectedFile) {
      void savePixelFiles([selectedFile.path]);
    }
  }, [selectedFile, savePixelFiles]);

  const actionsDisabled = !isConnected || pixel.isRunning || isPurging;
  const fileCount = files?.length ?? 0;

  return (
    <>
      {/* Mobile / small screens: preview opens in a dialog. */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-3xl">
          {selectedFile && preview ? (
            <>
              <DialogHeader>
                <DialogTitle className="truncate pr-8">
                  {selectedFile.name}
                </DialogTitle>
                <DialogDescription className="truncate">
                  {selectedFile.path}
                </DialogDescription>
              </DialogHeader>
              <PixelMediaPreview
                file={selectedFile}
                status={preview.status}
                localPath={preview.localPath}
                errorDetail={preview.detail}
                onSave={handleSave}
                mediaClassName="max-h-[70vh]"
              />
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <div className="flex min-h-0 min-w-0 flex-col gap-6">
        <ConnectionStatus
          isConnected={pixel.isConnected}
          isConnectionCheckPending={pixel.isConnectionCheckPending}
          disableRefresh={pixel.isRunning}
          onRefresh={() => {
            void pixel.checkConnection({ interactive: true });
          }}
        />

        <AvailableStorageCard
          storage={pixel.availableStorage}
          disabled={!pixel.isConnected || pixel.isRunning}
          onRefresh={() => {
            void pixel.refreshAvailableStorage();
          }}
        />

        <section className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Camera roll
              </h2>
              <p className="text-xs text-muted-foreground">
                {PIXEL_CAMERA_DIR}
                {files ? ` · ${fileCount} file${fileCount === 1 ? '' : 's'}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={actionsDisabled || isLoading}
                onClick={() => {
                  void loadFiles();
                }}
              >
                {isLoading ? (
                  <IconLoader2 size={16} className="animate-spin" />
                ) : (
                  <IconRefresh size={16} />
                )}
                Refresh
              </Button>

              <AlertDialog open={confirmPurge} onOpenChange={setConfirmPurge}>
                <AlertDialogTrigger
                  render={
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="gap-1.5"
                      disabled={actionsDisabled || fileCount === 0}
                    />
                  }
                >
                  <IconTrash size={16} />
                  Purge all
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Purge all files?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes every file in {PIXEL_CAMERA_DIR} on
                      the device. This cannot be undone — pull anything you want to
                      keep first.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPurging}>
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      variant="destructive"
                      disabled={isPurging}
                      onClick={() => {
                        void handlePurge();
                      }}
                    >
                      {isPurging ? 'Purging…' : 'Purge all files'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {!isConnected ? (
            <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              Connect a Pixel to browse the camera roll.
            </p>
          ) : isLoading && !files ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <IconLoader2 size={18} className="animate-spin" />
              Reading device files…
            </div>
          ) : files && files.length > 0 ? (
            <PixelFolderTree
              files={files}
              selectedPath={selectedFile?.path ?? null}
              onSelectFile={handleSelectFile}
            />
          ) : (
            <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              No files in the camera roll.
            </p>
          )}
        </section>
      </div>

      {/* Inline preview — fills the second column on large screens. */}
      <aside className="hidden min-h-0 min-w-0 flex-col gap-3 self-start lg:flex lg:sticky lg:top-0">
        {selectedFile && preview ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{selectedFile.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedFile.relativePath}
              </p>
            </div>
            <PixelMediaPreview
              key={selectedFile.path}
              file={selectedFile}
              status={preview.status}
              localPath={preview.localPath}
              errorDetail={preview.detail}
              onSave={handleSave}
              mediaClassName="flex-1 lg:max-h-[calc(100vh-12rem)]"
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground">
            Select a file to preview it here.
          </div>
        )}
      </aside>
    </>
  );
}
