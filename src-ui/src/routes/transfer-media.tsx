import { Link, createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconArrowRight,
  IconDownload,
  IconFile,
  IconFolder,
  IconLoader2,
} from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { toast } from 'sonner';
import TransferStatsPanel from '@/components/activity-stats/transfer-panel';
import { usePixel } from '@/hooks/use-pixel';
import {
  IMAGE_EXTENSIONS,
  PIXEL_CAMERA_DIR,
  VIDEO_EXTENSIONS,
} from '@/lib/constants';
import { formatBytes } from '@/lib/storage-size';
import type { PushSpaceCheckResult } from '@/lib/types';
import { ConnectionStatus } from '@/components/connection-status';
import { DeviceInfoCard } from '@/components/device-info-card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import SplitColumn from '@/components/ui/split-column';

export const Route = createFileRoute('/transfer-media')({
  staticData: {
    pageTitle: 'Transfer Media',
    pageDescription:
      'Push media to your Pixel camera roll or pull the camera roll to your Mac.',
  },
  component: TransferPage,
});

type PendingPush = {
  paths: string[];
  check: PushSpaceCheckResult;
};

interface TransferActionButtonProps {
  readonly icon: React.ReactNode;
  readonly title: string;
  readonly description: string;
  readonly disabled: boolean;
  readonly onClick: () => void;
}

function TransferActionButton({
  icon,
  title,
  description,
  disabled,
  onClick,
}: TransferActionButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-auto min-h-7 w-full items-start justify-start gap-2.5 px-3 py-2 whitespace-normal"
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
        <span className="font-medium leading-tight">{title}</span>
        <span className="text-xs font-normal leading-snug text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
}

function TransferPage() {
  const pixel = usePixel();
  const [isCheckingSpace, setIsCheckingSpace] = useState(false);
  const [pendingPush, setPendingPush] = useState<PendingPush | null>(null);

  const isDisabled =
    pixel.isRunning || !pixel.isConnected || isCheckingSpace;

  useEffect(() => {
    if (pixel.isConnected && !pixel.isRunning) {
      void pixel.refreshDeviceInfo();
    }
    // Only re-probe when connection flips on.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: connect edge
  }, [pixel.isConnected]);

  const beginPush = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0 || !pixel.isConnected) return;

      setIsCheckingSpace(true);
      const toastId = toast.loading('Checking free space on Pixel…');
      try {
        const check = await pixel.checkPushSpace(paths);
        toast.dismiss(toastId);

        if (check.status === 'ok') {
          toast.message(
            `Pushing ${formatBytes(check.needBytes)} · ${check.freeLabel} free`,
          );
          await pixel.pushPaths(paths);
          return;
        }

        // Insufficient or unknown: require an explicit decision.
        setPendingPush({ paths, check });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Space check failed.',
          { id: toastId },
        );
      } finally {
        setIsCheckingSpace(false);
      }
    },
    [pixel],
  );

  const handlePushFolder = useCallback(async () => {
    if (!pixel.isConnected) return;
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Folder to Push to Pixel',
    });
    if (selected && typeof selected === 'string') {
      await beginPush([selected]);
    }
  }, [pixel.isConnected, beginPush]);

  const handlePushFiles = useCallback(async () => {
    if (!pixel.isConnected) return;
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [
        {
          name: 'Media',
          extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
      title: 'Select Files to Push to Pixel',
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      await beginPush(paths);
    }
  }, [pixel.isConnected, beginPush]);

  const confirmPendingPush = useCallback(async () => {
    if (!pendingPush) return;
    const { paths } = pendingPush;
    setPendingPush(null);
    await pixel.pushPaths(paths);
  }, [pendingPush, pixel]);

  const pendingTitle =
    pendingPush?.check.status === 'insufficient'
      ? 'Not enough free space'
      : 'Could not verify free space';

  const pendingDescription = (() => {
    if (!pendingPush) return '';
    const { check } = pendingPush;
    if (check.status === 'insufficient') {
      return `This transfer is about ${formatBytes(check.needBytes)}, but the Pixel only has ${check.freeLabel} free (including a safety margin). Pushing may fail or fill the device. Split the folder smaller, free space on the device, or continue anyway.`;
    }
    if (check.status === 'unknown') {
      const sizePart =
        check.needBytes != null
          ? ` Payload is about ${formatBytes(check.needBytes)}.`
          : '';
      return `${check.reason}${sizePart} You can still push, but the app could not confirm the transfer will fit.`;
    }
    return '';
  })();

  // The last finished transfer was a push when its destination was the device.
  const lastTransferWasPush =
    !pixel.isRunning &&
    pixel.activeOperation === null &&
    pixel.transferPaths?.destination === PIXEL_CAMERA_DIR;

  return (
    <SplitColumn>
      <AlertDialog
        open={pendingPush !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPush(null);
        }}
      >
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>{pendingTitle}</AlertDialogTitle>
            <AlertDialogDescription>{pendingDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void confirmPendingPush();
              }}
            >
              Push anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex flex-col gap-6">
        {!pixel.isConnected ? (
          <ConnectionStatus
            isConnected={pixel.isConnected}
            isConnectionCheckPending={pixel.isConnectionCheckPending}
            disableRefresh={pixel.isRunning}
            onRefresh={() => {
              void pixel.checkConnection({ interactive: true });
            }}
          />
        ) : null}

        {pixel.transferInterrupted ? (
          <Alert variant="destructive">
            <IconAlertTriangle className="size-4" />
            <AlertTitle>Transfer interrupted</AlertTitle>
            <AlertDescription>
              The Pixel disconnected while files were transferring. The last
              file may be incomplete or corrupted on the device. Reconnect the
              Pixel, remove the partial file if needed, and run the transfer
              again.
            </AlertDescription>
          </Alert>
        ) : null}

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Transfer
          </h2>
          <div className="flex flex-col gap-2">
            <TransferActionButton
              icon={
                isCheckingSpace ? (
                  <IconLoader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                ) : (
                  <IconFolder className="size-3.5 shrink-0 text-primary" />
                )
              }
              title="Push Folder"
              description={`Upload a folder to ${PIXEL_CAMERA_DIR}`}
              disabled={isDisabled}
              onClick={() => {
                void handlePushFolder();
              }}
            />
            <TransferActionButton
              icon={<IconFile className="size-3.5 shrink-0 text-primary" />}
              title="Push Files"
              description="Upload specific files to your device"
              disabled={isDisabled}
              onClick={() => {
                void handlePushFiles();
              }}
            />
            <TransferActionButton
              icon={
                <IconDownload className="size-3.5 shrink-0 text-primary" />
              }
              title="Pull Camera"
              description="Download all media from Camera folder"
              disabled={isDisabled}
              onClick={pixel.pull}
            />
          </div>
        </section>

        <TransferStatsPanel />

        {lastTransferWasPush ? (
          <Link
            to="/manage-device"
            className="inline-flex items-center gap-1.5 self-start text-sm text-primary hover:underline"
          >
            Browse files on device
            <IconArrowRight className="size-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="flex flex-col min-h-0 gap-4">
        <DeviceInfoCard
          info={pixel.deviceInfo}
          disabled={!pixel.isConnected || pixel.isRunning || isCheckingSpace}
          onRefresh={() => {
            void pixel.refreshDeviceInfo();
          }}
        />
      </div>
    </SplitColumn>
  );
}
