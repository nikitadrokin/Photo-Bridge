import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useState } from 'react';
import ActivityFeed from '@/components/activity-feed';
import ConvertFiles, {
  type MediaJobMode,
} from '@/components/convert-files';
import DropzoneOverlay from '@/components/dropzone-overlay';
import SelectFiles from '@/components/select-files';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import { ALL_EXTENSIONS } from '@/lib/constants';
import { useMediaStore } from '@/stores/media-store';

/** Search params for `/convert` — `mode=copy` selects the copy pipeline. */
export type ConvertSearch = {
  mode: MediaJobMode;
};

export const Route = createFileRoute('/convert')({
  validateSearch: (raw: Record<string, unknown>): ConvertSearch => ({
    mode: raw.mode === 'copy' ? 'copy' : 'convert',
  }),
  staticData: { pageTitle: 'Convert & Copy' },
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
  const [runMode, setRunMode] = useState<'in-app' | 'terminal'>('in-app');
  const pixel = usePixel();

  const hasSelection = selectedPaths.length > 0;

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      setSelectedPaths(paths);
      pixel.clearLogs();
    },
  });

  return (
    <>
      <DropzoneOverlay isVisible={isDragging} extensions={ALL_EXTENSIONS} />

      <main className="flex-1 p-2">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8">
          {/* LEFT PANEL: Controls */}
          <div className="flex flex-col gap-6">
            {/* Empty state / File selection */}
            {!hasSelection ? (
              <SelectFiles />
            ) : (
              <ConvertFiles
                mediaJob={mediaJob}
                setMediaJob={setMediaJob}
                runMode={runMode}
                setRunMode={setRunMode}
              />
            )}
          </div>

          {/* RIGHT PANEL: Log Viewer / Terminal Message */}
          <div className="flex flex-col min-h-0">
            {runMode === 'terminal' ? (
              <div className="flex-1 min-h-[400px] flex flex-col items-center justify-center rounded-xl border bg-muted/20 text-muted-foreground">
                <div className="text-center space-y-2">
                  <p className="font-medium text-foreground">
                    Commands will open in {pixel.terminalName || 'Terminal'}
                  </p>
                  <p className="text-sm opacity-70">
                    Terminal execution coming soon
                  </p>
                </div>
              </div>
            ) : (
              <ActivityFeed
                emptyMessage={
                  mediaJob === 'copy'
                    ? 'Activity will appear here after copy'
                    : 'Activity will appear here after conversion'
                }
              />
            )}
          </div>
        </div>
      </main>
    </>
  );
}
