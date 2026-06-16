import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import {
  IconLoader2,
  IconRefresh,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import type { PixelFilePayload } from '@cli-protocol';
import { usePixel } from '@/hooks/use-pixel';
import { PIXEL_CAMERA_DIR } from '@/lib/constants';
import { AvailableStorageCard } from '@/components/available-storage-card';
import { ConnectionStatus } from '@/components/connection-status';
import PixelFileTable from '@/components/gallery/pixel-file-table';
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

export const Route = createFileRoute('/pixel')({
  staticData: {
    pageTitle: 'Pixel Device',
    pageDescription:
      'Browse, manage storage, and purge the camera roll on your connected Pixel.',
  },
  component: PixelPage,
});

function PixelPage() {
  const pixel = usePixel();
  const { isConnected, listPixelFiles, purgePixelFiles, refreshAvailableStorage } =
    pixel;

  const [files, setFiles] = useState<PixelFilePayload[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

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
    }
  }, [isConnected, loadFiles, refreshAvailableStorage]);

  const handlePurge = useCallback(async () => {
    setIsPurging(true);
    const result = await purgePixelFiles();
    if (result.ok) {
      toast.success(
        `Purged ${result.deleted} file${result.deleted === 1 ? '' : 's'} from the Pixel`,
      );
      setFiles([]);
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

  const actionsDisabled = !isConnected || pixel.isRunning || isPurging;
  const fileCount = files?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
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

      <section className="flex flex-col gap-3">
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
          <PixelFileTable files={files} />
        ) : (
          <p className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
            No files in the camera roll.
          </p>
        )}
      </section>
    </div>
  );
}
