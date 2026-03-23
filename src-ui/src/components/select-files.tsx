import { Folder, Images, UploadSimple } from '@phosphor-icons/react';
import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { usePixel } from '@/hooks/use-pixel';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '@/lib/constants';
import { useMediaStore } from '@/stores/media-store';

interface SelectFilesProps {}

const SelectFiles: React.FC<SelectFilesProps> = () => {
  const { setSelectedPaths } = useMediaStore();
  const pixel = usePixel();

  const selectFiles = useCallback(async () => {
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [
        {
          name: 'Media',
          extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
      title: 'Select Photos/Videos',
    });
    if (selected) {
      setSelectedPaths(Array.isArray(selected) ? selected : [selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Directory',
    });
    if (selected && typeof selected === 'string') {
      setSelectedPaths([selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-16 px-8 text-center transition-colors duration-200 hover:border-border hover:bg-muted/30">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <Images size={32} weight="duotone" className="text-primary" />
      </div>
      <h2 className="text-lg font-semibold tracking-tight mb-1">
        No files selected
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        Drag and drop files here, or use the buttons below to select media for
        conversion.
      </p>
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={selectFolder}
          disabled={pixel.isRunning}
          className="gap-2"
        >
          <Folder weight="duotone" />
          Select Folder
        </Button>
        <Button
          onClick={selectFiles}
          disabled={pixel.isRunning}
          className="gap-2"
        >
          <UploadSimple weight="bold" />
          Select Files
        </Button>
      </div>
    </div>
  );
};

export default SelectFiles;
