import { createFileRoute } from '@tanstack/react-router';
import { IconFolder, IconFolders, IconLoader2, IconX } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ActivityFeed from '@/components/activity-feed';
import SplitStatsPanel from '@/components/activity-stats/split-panel';
import DropzoneOverlay from '@/components/dropzone-overlay';
import { Button } from '@/components/ui/button';
import { ChoiceCardRadioGroup } from '@/components/ui/choice-card';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import { ALL_EXTENSIONS } from '@/lib/constants';
import {
  buildSplitArgs,
  type SplitMode,
  splitModeLabel,
} from '@/lib/split-args';
import { useMediaStore } from '@/stores/media-store';

const SPLIT_MODE_OPTIONS: ReadonlyArray<{
  value: SplitMode;
  title: string;
  description: string;
}> = [
  {
    value: 'date-hash',
    title: 'By month + duplicates',
    description:
      'YYYY-MM folders; hash subfolders only when duplicates share the same month.',
  },
  {
    value: 'date',
    title: 'By month',
    description:
      'Move files into YYYY-MM folders from capture or file metadata dates.',
  },
  {
    value: 'hash',
    title: 'By content hash',
    description:
      'Group identical files under SHA-256 hash folders (flat filenames inside).',
  },
  {
    value: 'date-recursive',
    title: 'Flatten by month',
    description:
      'Pull nested files (e.g. from prior hash splits) into flat month folders.',
  },
];

export const Route = createFileRoute('/split')({
  staticData: {
    pageTitle: 'Split Folder',
    pageDescription:
      'Organize media in place into month or hash folders without converting files.',
  },
  component: SplitPage,
});

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

function isLikelyDirectoryPath(path: string): boolean {
  const name = basenameOf(path);
  return !name.includes('.');
}

function SplitPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();
  const [mode, setMode] = useState<SplitMode>('date-hash');

  const selectedDirectory =
    selectedPaths.length === 1 && isLikelyDirectoryPath(selectedPaths[0])
      ? selectedPaths[0]
      : null;
  const isBusy = pixel.isRunning && pixel.activeOperation === 'split';

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Folder to Split',
    });
    if (selected && typeof selected === 'string') {
      setSelectedPaths([selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  const runSplit = useCallback(() => {
    if (!selectedDirectory) return;
    void pixel.split(selectedDirectory, { mode });
  }, [pixel, selectedDirectory, mode]);

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      const directory = paths.find(isLikelyDirectoryPath);
      if (!directory) {
        toast.error('Drop a folder to split.');
        return;
      }
      setSelectedPaths([directory]);
      pixel.clearLogs();
    },
  });

  const modeSummary = useMemo(() => splitModeLabel(mode), [mode]);

  return (
    <>
      <DropzoneOverlay isVisible={isDragging} extensions={ALL_EXTENSIONS} />

      <main className="flex-1 p-2">
        <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8">
          <div className="flex flex-col gap-6">
            {!selectedDirectory ? (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/60 bg-muted/20 py-16 px-8 text-center transition-colors duration-200 hover:border-border hover:bg-muted/30">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
                  <IconFolders
                    size={32}
                    className="text-primary"
                  />
                </div>
                <h2 className="text-lg font-semibold tracking-tight mb-1">
                  Select a media folder
                </h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                  Split moves files within the folder you choose. Pick a library
                  or export directory to organize by month or content hash.
                </p>
                <Button
                  type="button"
                  onClick={() => void selectFolder()}
                  disabled={pixel.isRunning}
                  className="gap-2"
                >
                  <IconFolder />
                  Select Folder
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                      <IconFolder
                        size={16}
                        className="text-primary"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {basenameOf(selectedDirectory)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedDirectory}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0"
                    aria-label="Clear selection"
                  >
                    <IconX size={16} />
                  </Button>
                </div>

                <ChoiceCardRadioGroup
                  legend="Layout"
                  value={mode}
                  onValueChange={setMode}
                  options={SPLIT_MODE_OPTIONS}
                  disabled={pixel.isRunning}
                  name="split-mode"
                />

                <p className="text-xs text-muted-foreground -mt-2">
                  {modeSummary}. Files are moved in place under the selected
                  folder.
                </p>

                <SplitStatsPanel />

                <Button
                  type="button"
                  className="gap-2 w-fit"
                  disabled={pixel.isRunning}
                  onClick={runSplit}
                >
                  {isBusy ? (
                    <IconLoader2 size={18} className="animate-spin" />
                  ) : (
                    <IconFolders size={18} />
                  )}
                  {isBusy ? 'Splitting folder…' : 'Split Folder'}
                </Button>
              </>
            )}
          </div>

          <div className="flex flex-col min-h-0">
            <ActivityFeed emptyMessage="Activity will appear here after splitting" />
          </div>
        </div>
      </main>
    </>
  );
}
