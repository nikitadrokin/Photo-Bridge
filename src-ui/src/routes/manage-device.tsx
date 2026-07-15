import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowRight,
  IconFolderOpen,
  IconLoader2,
  IconTerminal2,
  IconTrash,
} from '@tabler/icons-react';
import { appCacheDir } from '@tauri-apps/api/path';
import { Command } from '@tauri-apps/plugin-shell';
import { toast } from 'sonner';
import type { PixelFilePayload } from '@cli-protocol';
import { usePixel } from '@/hooks/use-pixel';
import { useIsLargeScreen } from '@/hooks/use-is-large-screen';
import { PIXEL_CAMERA_DIR } from '@/lib/constants';
import { DeviceInfoCard } from '@/components/device-info-card';
import { ConnectionStatus } from '@/components/connection-status';
import PixelFolderTree from '@/components/gallery/pixel-folder-tree';
import PixelMediaPreview, {
  type PixelPreviewStatus,
} from '@/components/gallery/pixel-media-preview';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SplitColumn from '@/components/ui/split-column';

/** The word the user must type before a purge is allowed to run. */
const PURGE_CONFIRM_WORD = 'purge';

export const Route = createFileRoute('/manage-device')({
  staticData: {
    pageTitle: 'Manage Device',
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
    refreshDeviceInfo,
  } = pixel;

  const isLargeScreen = useIsLargeScreen();

  const [files, setFiles] = useState<Array<PixelFilePayload> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedFile, setSelectedFile] = useState<PixelFilePayload | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeConfirmText, setPurgeConfirmText] = useState('');
  const [isPurging, setIsPurging] = useState(false);
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
      void refreshDeviceInfo();
    } else {
      setFiles(null);
      setSelectedFile(null);
      setPreview(null);
      setDialogOpen(false);
      setPurgeDialogOpen(false);
      setPurgeConfirmText('');
    }
  }, [isConnected, loadFiles, refreshDeviceInfo]);

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
          setPreview({
            status: 'error',
            localPath: null,
            detail: result.detail,
          });
        }
      })();
    },
    [isLargeScreen, pullPixelFileToCache],
  );

  const handleSave = useCallback(() => {
    if (selectedFile) {
      void savePixelFiles([selectedFile.path]);
    }
  }, [selectedFile, savePixelFiles]);

  const openCacheInFinder = useCallback(async () => {
    const cacheDir = await appCacheDir();
    await Command.create('open', [cacheDir]).execute();
  }, []);

  const purgeLocalCache = useCallback(async () => {
    const cacheDir = await appCacheDir();
    await Command.create('exec-sh', [
      '-c',
      `rm -rf ${JSON.stringify(cacheDir)}/*`,
    ]).execute();
    toast.success('Local cache purged');
  }, []);

  const fileCount = files?.length ?? 0;
  const purgeConfirmed =
    purgeConfirmText.trim().toLowerCase() === PURGE_CONFIRM_WORD;
  // Purging mid-transfer could delete files adb is still writing.
  const canPurge =
    isConnected && !pixel.isRunning && !isPurging && fileCount > 0;

  const handleConfirmPurge = useCallback(async () => {
    if (!isConnected || pixel.isRunning || isPurging) return;
    setIsPurging(true);
    const result = await purgePixelFiles();
    setIsPurging(false);
    setPurgeDialogOpen(false);
    setPurgeConfirmText('');
    if (result.ok) {
      toast.success(
        `Purged ${result.deleted} file${result.deleted === 1 ? '' : 's'} from the camera roll`,
      );
      setSelectedFile(null);
      setPreview(null);
      void loadFiles();
      void refreshDeviceInfo();
    } else {
      toast.error('Purge failed', { description: result.detail });
      void loadFiles();
    }
  }, [
    isConnected,
    pixel.isRunning,
    isPurging,
    purgePixelFiles,
    loadFiles,
    refreshDeviceInfo,
  ]);

  return (
    <SplitColumn fillHeight>
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

      <AlertDialog
        open={purgeDialogOpen}
        onOpenChange={(open) => {
          if (isPurging) return;
          setPurgeDialogOpen(open);
          if (!open) setPurgeConfirmText('');
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Purge camera roll?</AlertDialogTitle>
            <AlertDialogDescription>
              This deletes approximately {fileCount} file
              {fileCount === 1 ? '' : 's'} in{' '}
              <span className="font-mono">{PIXEL_CAMERA_DIR}</span> on the
              device. Only purge after Google Photos shows the backup is
              complete — deleted files cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="purge-confirm">
              Type &ldquo;{PURGE_CONFIRM_WORD}&rdquo; to confirm
            </Label>
            <Input
              id="purge-confirm"
              autoComplete="off"
              value={purgeConfirmText}
              disabled={isPurging}
              onChange={(event) => setPurgeConfirmText(event.target.value)}
              placeholder={PURGE_CONFIRM_WORD}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurging}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={!purgeConfirmed || !canPurge}
              onClick={() => {
                void handleConfirmPurge();
              }}
            >
              {isPurging ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Purging…
                </>
              ) : (
                'Purge camera roll'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex min-h-0 min-w-0 flex-col gap-6">
        {!isConnected ? (
          <ConnectionStatus
            className="shrink-0"
            isConnected={pixel.isConnected}
            isConnectionCheckPending={pixel.isConnectionCheckPending}
            disableRefresh={pixel.isRunning}
            onRefresh={() => {
              void pixel.checkConnection({ interactive: true });
            }}
          />
        ) : null}

        <DeviceInfoCard
          className="shrink-0"
          info={pixel.deviceInfo}
          disabled={!pixel.isConnected || pixel.isRunning}
          refreshing={isLoading}
          onRefresh={() => {
            void loadFiles();
            void refreshDeviceInfo();
            void pixel.checkConnection({ interactive: false });
          }}
        />

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex shrink-0 items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Camera roll
              </h2>
              <p className="text-xs text-muted-foreground">
                {PIXEL_CAMERA_DIR}
                {files
                  ? ` · ${fileCount} file${fileCount === 1 ? '' : 's'}`
                  : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {import.meta.env.DEV && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      void openCacheInFinder();
                    }}
                  >
                    <IconFolderOpen size={16} />
                    Cache
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => {
                      void purgeLocalCache();
                    }}
                  >
                    <IconTrash size={16} />
                    Purge Cache
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="gap-1.5"
                disabled={!canPurge}
                onClick={() => {
                  setPurgeConfirmText('');
                  setPurgeDialogOpen(true);
                }}
              >
                <IconTrash size={16} />
                Purge camera roll
              </Button>
            </div>
          </div>

          {!isConnected ? (
            <p className="shrink-0 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              Connect a Pixel to browse the camera roll.
            </p>
          ) : isLoading && !files ? (
            <div className="flex shrink-0 items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <IconLoader2 size={18} className="animate-spin" />
              Reading device files…
            </div>
          ) : files && files.length > 0 ? (
            <PixelFolderTree
              files={files}
              selectedPath={selectedFile?.path ?? null}
              onSelectFile={handleSelectFile}
              // min-h-40 keeps the tree usable on short windows: the page
              // scrolls the overflow instead of collapsing the tree to zero.
              className="min-h-40 flex-1"
            />
          ) : (
            <div className="flex shrink-0 flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
              <p>No files in the camera roll.</p>
              <Link
                to="/transfer-media"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                Transfer media
                <IconArrowRight className="size-3.5" />
              </Link>
            </div>
          )}
        </section>

        <div className="shrink-0 space-y-2 border-t border-border/60 pt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Advanced
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto min-h-6 w-full items-start justify-start gap-2 px-2 py-1.5 whitespace-normal"
            disabled={!isConnected}
            onClick={pixel.openCameraShellInTerminal}
          >
            <IconTerminal2 className="size-3 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-col items-start gap-px text-left">
              <span className="font-medium leading-tight">
                Open Camera Shell
              </span>
              <span className="text-xs font-normal leading-snug text-muted-foreground">
                Launch an ADB shell in {PIXEL_CAMERA_DIR}
              </span>
            </span>
          </Button>
        </div>
      </div>

      {/* Inline preview — fills the second column on large screens. */}
      <aside className="hidden min-h-0 min-w-0 flex-col gap-3 self-start lg:flex lg:sticky lg:top-0">
        {selectedFile && preview ? (
          <>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {selectedFile.name}
              </p>
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
    </SplitColumn>
  );
}
