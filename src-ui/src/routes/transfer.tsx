import { createFileRoute } from '@tanstack/react-router';
import {
  IconDownload,
  IconFile,
  IconFolder,
  IconAlertTriangle,
  IconTerminal2,
} from '@tabler/icons-react';
import TransferStatsPanel from '@/components/activity-stats/transfer-panel';
import { usePixel } from '@/hooks/use-pixel';
import { PIXEL_CAMERA_DIR } from '@/lib/constants';
import { AvailableStorageCard } from '@/components/available-storage-card';
import { ConnectionStatus } from '@/components/connection-status';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import SplitColumn from '@/components/ui/split-column';

export const Route = createFileRoute('/transfer')({
  staticData: { pageTitle: 'Transfer Media' },
  component: TransferPage,
});

function TransferPage() {
  const pixel = usePixel();

  const isDisabled = pixel.isRunning || !pixel.isConnected;

  return (
    <SplitColumn>
      {/* Connection Status */}
      <div className="flex flex-col gap-6">
        <ConnectionStatus
          isConnected={pixel.isConnected}
          isConnectionCheckPending={pixel.isConnectionCheckPending}
          disableRefresh={pixel.isRunning}
          onRefresh={() => {
            void pixel.checkConnection({ interactive: true });
          }}
        />

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
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-7 w-full items-start justify-start gap-2.5 px-3 py-2 whitespace-normal"
              disabled={isDisabled}
              onClick={pixel.pushFolder}
            >
              <IconFolder className="size-3.5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="font-medium leading-tight">Push Folder</span>
                <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Upload a folder to {PIXEL_CAMERA_DIR}
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-7 w-full items-start justify-start gap-2.5 px-3 py-2 whitespace-normal"
              disabled={isDisabled}
              onClick={pixel.pushFiles}
            >
              <IconFile className="size-3.5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="font-medium leading-tight">Push Files</span>
                <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Upload specific files to your device
                </span>
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-7 w-full items-start justify-start gap-2.5 px-3 py-2 whitespace-normal"
              disabled={isDisabled}
              onClick={pixel.pull}
            >
              <IconDownload className="size-3.5 shrink-0 text-primary" />
              <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                <span className="font-medium leading-tight">Pull Camera</span>
                <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                  Download all media from Camera folder
                </span>
              </span>
            </Button>
          </div>

          <div className="space-y-2 border-t border-border/60 pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
              Advanced
            </p>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto min-h-6 w-full items-start justify-start gap-2 px-2 py-1.5 whitespace-normal"
              // this can be used even when transferring to the device
              disabled={!pixel.isConnected}
              onClick={pixel.openCameraShellInTerminal}
            >
              <IconTerminal2 className="size-3 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-col items-start gap-px text-left">
                <span className="font-medium leading-tight">
                  Open Camera Shell
                </span>
                <span className="text-[10px] font-normal leading-snug text-muted-foreground/80">
                  Launch an ADB shell in {PIXEL_CAMERA_DIR}
                </span>
              </span>
            </Button>
          </div>
        </section>

        <TransferStatsPanel />
      </div>

      <div className="flex flex-col min-h-0 gap-4">
        <AvailableStorageCard
          storage={pixel.availableStorage}
          disabled={!pixel.isConnected || pixel.isRunning}
          onRefresh={() => {
            void pixel.refreshAvailableStorage();
          }}
        />
      </div>
    </SplitColumn>
  );
}
