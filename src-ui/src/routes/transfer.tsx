import { createFileRoute } from '@tanstack/react-router';
import { DownloadSimple, File, Folder, Terminal } from '@phosphor-icons/react';
import ActivityFeed from '@/components/activity-feed';
import TransferStatsPanel from '@/components/transfer-stats-panel';
import { usePixel } from '@/hooks/use-pixel';
import { ConnectionStatus } from '@/components/connection-status';
import { ActionCard } from '@/components/action-card';

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
              isRunning={pixel.isRunning}
              onRefresh={pixel.checkConnection}
            />

            <section>
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Actions
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <ActionCard
                  icon={<Folder size={24} weight="duotone" />}
                  title="Push Folder"
                  description="Upload a folder to /sdcard/DCIM/Camera"
                  onClick={pixel.pushFolder}
                  disabled={isDisabled}
                />
                <ActionCard
                  icon={<File size={24} weight="duotone" />}
                  title="Push Files"
                  description="Upload specific files to your device"
                  onClick={pixel.pushFiles}
                  disabled={isDisabled}
                />
                <ActionCard
                  icon={<DownloadSimple size={24} weight="duotone" />}
                  title="Pull Camera"
                  description="Download all media from Camera folder"
                  onClick={pixel.pull}
                  disabled={isDisabled}
                />
                <ActionCard
                  icon={<Terminal size={24} weight="duotone" />}
                  title="Open Shell"
                  description="Launch an interactive ADB shell"
                  onClick={pixel.shell}
                />
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
