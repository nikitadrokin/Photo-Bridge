import { createFileRoute } from '@tanstack/react-router';
import { DownloadSimple, File, Folder, Terminal } from '@phosphor-icons/react';
import ActivityFeed from '@/components/activity-feed';
import TransferStatsPanel from '@/components/activity-stats/transfer-panel';
import { usePixel } from '@/hooks/use-pixel';
import { ConnectionStatus } from '@/components/connection-status';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/transfer')({
  staticData: { pageTitle: 'Pixel Transfer' },
  component: TransferPage,
});

function TransferPage() {
  const pixel = usePixel();

  const isDisabled = pixel.isRunning || !pixel.isConnected;

  return (
    <>
      <main className="flex-1 p-2 lg:p-4">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8">
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
                  <Folder
                    className="size-3.5 shrink-0 text-primary"
                    weight="duotone"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="font-medium leading-tight">
                      Push Folder
                    </span>
                    <span className="text-[11px] font-normal leading-snug text-muted-foreground">
                      Upload a folder to /sdcard/DCIM/Camera
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
                  <File
                    className="size-3.5 shrink-0 text-primary"
                    weight="duotone"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="font-medium leading-tight">
                      Push Files
                    </span>
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
                  <DownloadSimple className="size-3.5 shrink-0 text-primary" />
                  <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
                    <span className="font-medium leading-tight">
                      Pull Camera
                    </span>
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
                  onClick={pixel.shell}
                >
                  <Terminal
                    className="size-3 shrink-0 text-muted-foreground"
                    weight="duotone"
                  />
                  <span className="flex min-w-0 flex-col items-start gap-px text-left">
                    <span className="font-medium leading-tight">
                      Open Shell
                    </span>
                    <span className="text-[10px] font-normal leading-snug text-muted-foreground/80">
                      Launch an interactive ADB shell
                    </span>
                  </span>
                </Button>
              </div>
            </section>

            <TransferStatsPanel />
          </div>

          <div className="flex flex-col min-h-0">
            <ActivityFeed emptyMessage="Connect your Pixel to get started" />
          </div>
        </div>
      </main>
    </>
  );
}
