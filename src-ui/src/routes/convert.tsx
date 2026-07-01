import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback } from 'react';
import ConvertFiles, { type MediaJobMode } from '@/components/convert-files';
import SelectFiles from '@/components/select-files';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import {
  ALL_EXTENSIONS,
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
} from '@/lib/constants';
import { useMediaStore } from '@/stores/media-store';
import SplitColumn from '@/components/ui/split-column';
import { open } from '@tauri-apps/plugin-dialog';
import { IconPhoto } from '@tabler/icons-react';

/** Search params for `/convert` — `mode=convert` selects the remux pipeline; copy is the default. */
export type ConvertSearch = {
  mode: MediaJobMode;
};

export const Route = createFileRoute('/convert')({
  validateSearch: (raw: Record<string, unknown>): ConvertSearch => ({
    mode: raw.mode === 'convert' ? 'convert' : 'copy',
  }),
  staticData: { pageTitle: 'Convert Media' },
  component: ConvertPage,
});

function ConvertPage() {
  const { selectedPaths, setSelectedPaths } = useMediaStore();
  const { mode: mediaJob } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const setMediaJob = useCallback(
    (mode: MediaJobMode) => {
      void navigate({ search: { mode }, replace: true });
    },
    [navigate],
  );
  const pixel = usePixel();

  const hasSelection = selectedPaths.length > 0;

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      setSelectedPaths(paths);
      pixel.clearLogs();
    },
  });

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

  if (!hasSelection) {
    return (
      <SelectFiles
        icon={<IconPhoto size={32} className="text-primary" />}
        title="No files selected"
        description="Drag and drop files here, or use the buttons below to select media for
        conversion."
        isDragging={isDragging}
        onClickFolder={() => void selectFolder()}
        // onClickFiles={() => void selectFiles()}
        disabled={pixel.isRunning}
      />
    );
  }

  return (
    <SplitColumn>
      {/* LEFT PANEL: Controls */}
      <div className="flex flex-col gap-6">
        {/* Empty state / File selection */}
        <ConvertFiles mediaJob={mediaJob} setMediaJob={setMediaJob} />
      </div>

      {/* RIGHT PANEL: Log Viewer / Terminal Message */}
      <div className="flex flex-col min-h-0"></div>
    </SplitColumn>
  );
}
