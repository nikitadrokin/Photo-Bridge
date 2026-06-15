import { createFileRoute } from '@tanstack/react-router';
import {
  IconFolder,
  IconFolders,
  IconLoader2,
  IconX,
} from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import SplitStatsPanel from '@/components/activity-stats/split-panel';
import { Button } from '@/components/ui/button';
import { ChoiceCardRadioGroup } from '@/components/ui/choice-card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import { ALL_EXTENSIONS } from '@/lib/constants';
import { findDirectoryPath, useSelectedDirectory } from '@/lib/path';
import { type SplitMode, splitModeLabel } from '@/lib/split-args';
import { useMediaStore } from '@/stores/media-store';
import { cn } from '@/lib/utils';

const SPLIT_MODE_OPTIONS: ReadonlyArray<{
  value: SplitMode;
  title: string;
  description: string;
}> = [
  {
    value: 'date',
    title: 'By month',
    description:
      'YYYY-MM folders; files sharing a content hash in the same month are grouped into a hash subfolder for easy comparison.',
  },
  {
    value: 'size',
    title: 'By size',
    description: 'Split into Part folders, each within a total size limit.',
  },
  {
    value: 'count',
    title: 'By count',
    description: 'Split into Part folders, each holding up to N files.',
  },
];

export const Route = createFileRoute('/split')({
  staticData: {
    pageTitle: 'Split Folder',
    pageDescription:
      'Organize media in place into month or size-limited folders without converting files.',
  },
  component: SplitPage,
});

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

function SplitPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();
  const [mode, setMode] = useState<SplitMode>('date');
  const [limitValue, setLimitValue] = useState('');
  const [dateByDay, setDateByDay] = useState(false);

  const selectedDirectory = useSelectedDirectory(selectedPaths);
  const isBusy = pixel.isRunning && pixel.activeOperation === 'split';

  const needsLimit = mode === 'size' || mode === 'count';
  const isLimitValid = !needsLimit || limitValue.trim().length > 0;

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
    if (!selectedDirectory || !isLimitValid) return;
    void pixel.split(selectedDirectory, {
      mode,
      limitValue: needsLimit ? limitValue.trim() : undefined,
      dateByDay: mode === 'date' ? dateByDay : undefined,
    });
  }, [
    pixel,
    selectedDirectory,
    mode,
    limitValue,
    isLimitValid,
    needsLimit,
    dateByDay,
  ]);

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      void (async () => {
        const directory = await findDirectoryPath(paths);
        if (!directory) {
          toast.error('Drop a folder to split.');
          return;
        }
        setSelectedPaths([directory]);
        pixel.clearLogs();
      })();
    },
  });

  const modeSummary = useMemo(
    () => splitModeLabel(mode, dateByDay),
    [mode, dateByDay],
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {!selectedDirectory ? (
          <div
            className={cn(
              'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 px-8 text-center transition-colors duration-200',
              isDragging
                ? 'border-primary bg-primary/10'
                : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
            )}
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
              <IconFolders size={32} className="text-primary" />
            </div>
            <h2 className="text-lg font-semibold tracking-tight mb-1">
              Select a media folder
            </h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm">
              Split moves files within the folder you choose. Pick a library or
              export directory to organize by month or size.
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
                  <IconFolder size={16} className="text-primary" />
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
              onValueChange={(value) => {
                setMode(value);
                setLimitValue('');
                setDateByDay(false);
              }}
              options={SPLIT_MODE_OPTIONS}
              disabled={pixel.isRunning}
              name="split-mode"
            />

            {mode === 'date' && (
              <Label
                htmlFor="date-by-day"
                className="flex cursor-pointer items-center justify-between -mt-2 py-1"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium leading-none">
                    Group by day
                  </span>
                  <span className="text-xs font-normal text-muted-foreground">
                    Adds a DD subfolder inside each YYYY-MM folder
                  </span>
                </div>
                <Switch
                  id="date-by-day"
                  checked={dateByDay}
                  onCheckedChange={setDateByDay}
                  disabled={pixel.isRunning}
                />
              </Label>
            )}

            {needsLimit && (
              <div className="flex flex-col gap-1.5 -mt-2">
                <label
                  htmlFor="limit-value"
                  className="text-xs font-medium text-muted-foreground"
                >
                  {mode === 'size'
                    ? 'Size limit per folder'
                    : 'Max files per folder'}
                </label>
                <Input
                  id="limit-value"
                  placeholder={
                    mode === 'size' ? 'e.g. 4gb, 500mb' : 'e.g. 1000'
                  }
                  value={limitValue}
                  onChange={(e) => setLimitValue(e.target.value)}
                  disabled={pixel.isRunning}
                  className="h-8 text-sm"
                />
              </div>
            )}

            <p className="text-xs text-muted-foreground -mt-2">
              {modeSummary}. Files are moved in place under the selected folder.
            </p>

            <Button
              type="button"
              className="gap-2 w-fit"
              disabled={pixel.isRunning || !isLimitValid}
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

      {selectedDirectory && (
        <div className="flex flex-col min-h-0 gap-4">
          <SplitStatsPanel />
        </div>
      )}
    </>
  );
}
