import { createFileRoute } from '@tanstack/react-router';
import { DownloadSimple, File, Folder, Terminal } from '@phosphor-icons/react';
import LogViewer from '@/components/log-viewer';
import { usePixel } from '@/contexts/pixel-context';
import { ConnectionStatus } from '@/components/connection-status';
import { ActionCard } from '@/components/action-card';
import { PageHeader } from '@/components/page-header';

export const Route = createFileRoute('/transfer')({ component: TransferPage });

function TransferPage() {
  const pixel = usePixel();

  const isDisabled = pixel.isRunning || !pixel.isConnected;

  return (
    <>
      <PageHeader
        title="Pixel Transfer"
        description="Push and pull files to your Pixel device via ADB"
      />

      <main className="flex-1 overflow-auto px-6 pb-6">
        <div className="mx-auto flex flex-col max-w-5xl gap-8 pb-6">
          {/* Connection Status */}
          <ConnectionStatus
            isConnected={pixel.isConnected}
            isRunning={pixel.isRunning}
            onRefresh={pixel.checkConnection}
          />

          {/* Quick Actions */}
          <section>
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Actions
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                disabled={isDisabled}
              />
            </div>
          </section>

          {/* Transfer Logs */}
          {/* <section className="flex flex-col min-h-0">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
              Transfer Logs
            </h2>
            <LogViewer emptyMessage="Connect your Pixel to get started" />
          </section> */}
        </div>
      </main>
    </>
  );
}
