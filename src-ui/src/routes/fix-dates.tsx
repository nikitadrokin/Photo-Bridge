import { createFileRoute } from '@tanstack/react-router';
import { IconFolder, IconClock, IconLoader2, IconX } from '@tabler/icons-react';
import { open } from '@tauri-apps/plugin-dialog';
import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { type FixDatesWriteMode, usePixel } from '@/hooks/use-pixel';
import { ALL_EXTENSIONS } from '@/lib/constants';
import { findDirectoryPath, useSelectedDirectory } from '@/lib/path';
import { useMediaStore } from '@/stores/media-store';
import { cn } from '@/lib/utils';
import SplitColumn from '@/components/ui/split-column';

export const Route = createFileRoute('/fix-dates')({
  staticData: {
    pageTitle: 'Fix Dates',
    pageDescription:
      'Repair embedded media dates for a folder without converting files.',
  },
  component: FixDatesPage,
});

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

function FixDatesPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();
  const [writeMode, setWriteMode] =
    useState<FixDatesWriteMode>('copy-directory');

  const selectedDirectory = useSelectedDirectory(selectedPaths);
  const isCopyMode = writeMode === 'copy-directory';
  const isBusy = pixel.isRunning && pixel.activeOperation === 'fix-dates';

  const selectFolder = useCallback(async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Media Folder',
    });
    if (selected && typeof selected === 'string') {
      setSelectedPaths([selected]);
      pixel.clearLogs();
    }
  }, [pixel, setSelectedPaths]);

  const runFixDates = useCallback(() => {
    if (!selectedDirectory) return;
    void pixel.fixDates([selectedDirectory], { writeMode });
  }, [pixel, selectedDirectory, writeMode]);

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      void (async () => {
        const directory = await findDirectoryPath(paths);
        if (!directory) {
          toast.error('Drop a folder to fix dates for a directory.');
          return;
        }
        setSelectedPaths([directory]);
        pixel.clearLogs();
      })();
    },
  });

  const modeDescription = useMemo(() => {
    if (isCopyMode) {
      return 'Creates a sibling _FixedDates folder and writes metadata into the copied files.';
    }
    return 'Writes metadata directly into the selected folder.';
  }, [isCopyMode]);

  if (!selectedDirectory) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 px-8 text-center transition-colors duration-200 col-span-full',
          isDragging
            ? 'border-primary bg-primary/10'
            : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
        )}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
          <IconFolder size={32} className="text-primary" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight mb-1">
          Select a media folder
        </h2>
        <p className="text-sm text-muted-foreground mb-6 max-w-sm">
          Fix Dates works on one folder at a time. Use this when files are
          already Pixel-compatible and only need metadata repair.
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
    );
  }

  return (
    <SplitColumn>
      <div className="flex flex-col gap-6">
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

          <FieldSet className="rounded-lg border bg-card p-3 gap-3">
            <FieldLegend variant="label">Write mode</FieldLegend>
            <FieldLabel
              htmlFor="fix-dates-overwrite-original"
              className="w-full"
            >
              <Field orientation="horizontal">
                <FieldContent>
                  <FieldTitle className="text-sm">
                    Overwrite selected folder
                  </FieldTitle>
                  <FieldDescription className="text-xs">
                    {modeDescription}
                  </FieldDescription>
                </FieldContent>
                <Switch
                  id="fix-dates-overwrite-original"
                  checked={!isCopyMode}
                  onCheckedChange={(checked) =>
                    setWriteMode(checked ? 'overwrite' : 'copy-directory')
                  }
                  disabled={pixel.isRunning}
                />
              </Field>
            </FieldLabel>
          </FieldSet>

          <Button
            type="button"
            className="gap-2 w-fit"
            disabled={pixel.isRunning}
            onClick={runFixDates}
          >
            {isBusy ? (
              <IconLoader2 size={18} className="animate-spin" />
            ) : (
              <IconClock size={18} />
            )}
            {isBusy ? 'Fixing dates...' : 'Fix Dates'}
          </Button>
        </>
      </div>

      <div className="flex flex-col min-h-0"></div>
    </SplitColumn>
  );
}
