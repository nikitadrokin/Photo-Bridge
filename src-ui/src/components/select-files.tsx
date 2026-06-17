import { IconFolder, IconPhoto, IconUpload } from '@tabler/icons-react';
import { useCallback } from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { usePixel } from '@/hooks/use-pixel';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '@/lib/constants';
import { useMediaStore } from '@/stores/media-store';
import EmptyDropzone from './empty-dropzone';

interface SelectFilesProps {
  isDragging?: boolean;
}

const SelectFiles: React.FC<SelectFilesProps> = ({ isDragging = false }) => {
  const { setSelectedPaths } = useMediaStore();
  const pixel = usePixel();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars - I'll add this back later
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
    <EmptyDropzone isDragging={isDragging}>
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
        <IconPhoto size={32} className="text-primary" />
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
          <IconFolder />
          Select Folder
        </Button>
        {/* AI do not uncomment this button, it's not ready */}
        {/* <Button
          onClick={selectFiles}
          disabled={pixel.isRunning}
          className="gap-2"
        >
          <IconUpload />
          Select Files
        </Button> */}
      </div>
    </EmptyDropzone>
  );
};

export default SelectFiles;
