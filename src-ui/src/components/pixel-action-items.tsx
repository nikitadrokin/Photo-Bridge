import {
  DownloadSimple,
  Export,
  File,
  Folder,
  Terminal,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import ActionItem from '@/components/action-item';
import { usePixel } from '@/hooks/use-pixel';

const PixelActionItems: React.FC = () => {
  const pixel = usePixel();

  return (
    <>
      {/* Push to Pixel */}
      <ActionItem
        icon={<Export size={24} weight="bold" />}
        iconClass={
          pixel.isConnected ? 'text-green-500' : 'text-muted-foreground'
        }
        title="Push to Pixel"
        description={
          pixel.isConnected
            ? `Push files to ${PIXEL_CAMERA_DIR}`
            : 'Connect a Pixel device first'
        }
        disabled={!pixel.isConnected}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={pixel.pushFolder}
          disabled={pixel.isRunning || !pixel.isConnected}
        >
          <Folder data-icon="inline-start" /> Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={pixel.pushFiles}
          disabled={pixel.isRunning || !pixel.isConnected}
        >
          <File data-icon="inline-start" /> Files
        </Button>
      </ActionItem>

      {/* Pull from Pixel */}
      <ActionItem
        icon={<DownloadSimple size={24} weight="bold" />}
        iconClass={
          pixel.isConnected ? 'text-blue-500' : 'text-muted-foreground'
        }
        title="Pull from Pixel"
        description={
          pixel.isConnected
            ? 'Download Camera folder to chosen directory'
            : 'Connect a Pixel device first'
        }
        disabled={!pixel.isConnected}
      >
        <Button
          variant="outline"
          onClick={pixel.pull}
          disabled={pixel.isRunning || !pixel.isConnected}
        >
          Pull
        </Button>
      </ActionItem>

      {/* Open Camera Shell */}
      <ActionItem
        icon={<Terminal size={24} weight="bold" />}
        iconClass={
          pixel.isConnected ? 'text-purple-500' : 'text-muted-foreground'
        }
        title="Open Camera Shell"
        description={
          pixel.isConnected
            ? `Open an ADB shell in ${PIXEL_CAMERA_DIR}`
            : 'Connect a Pixel device first'
        }
        disabled={!pixel.isConnected}
      >
        <Button
          variant="outline"
          onClick={pixel.shell}
          disabled={pixel.isRunning || !pixel.isConnected}
        >
          Open
        </Button>
      </ActionItem>
    </>
  );
};

export default PixelActionItems;
