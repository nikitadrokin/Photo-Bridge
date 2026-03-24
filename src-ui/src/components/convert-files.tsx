import {
  Clock,
  File,
  Play,
  Spinner,
  X,
} from '@phosphor-icons/react';
import { useMediaStore } from '@/stores/media-store';
import { usePixel } from '@/hooks/use-pixel';
import { Button } from '@/components/ui/button';
import { ChoiceCardRadioGroup } from '@/components/ui/choice-card';
import ConversionStatsPanel from './conversion-stats/panel';

/** Primary pipeline: transcode for Pixel vs copy/rename for upload. */
export type MediaJobMode = 'convert' | 'copy';

const MEDIA_JOB_OPTIONS = [
  {
    value: 'copy' as const,
    title: 'Copy Bit-for-Bit',
    description:
      "Faster and preserves original quality, but won't always upload to Pixel.",
  },
  {
    value: 'convert' as const,
    title: 'Remux to MP4',
    description:
      "Transcode files so they are compatible with the Pixel. Use this when videos don't upload using the mode above.",
  },
];

interface ConvertFilesProps {
  mediaJob: MediaJobMode;
  setMediaJob: (mode: MediaJobMode) => void;
}

const ConvertFiles: React.FC<ConvertFilesProps> = ({
  mediaJob,
  setMediaJob,
}) => {
  const { selectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();

  return (
    <>
      {/* Selected files bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <File size={16} weight="duotone" className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">
              {selectedPaths.length} item
              {selectedPaths.length !== 1 ? 's' : ''} selected
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {selectedPaths[0]?.split('/').pop()}
              {selectedPaths.length > 1
                ? ` and ${selectedPaths.length - 1} more`
                : ''}
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
          <X size={16} weight="bold" />
        </Button>
      </div>

      <ChoiceCardRadioGroup
        legend="Processing mode"
        value={mediaJob}
        onValueChange={setMediaJob}
        options={MEDIA_JOB_OPTIONS}
        disabled={pixel.isRunning}
        name="media-job"
      />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          title={
            mediaJob === 'convert'
              ? 'Make compatible with Pixel'
              : 'Copy/rename for Pixel upload'
          }
          onClick={() => {
            if (mediaJob === 'convert') {
              return pixel.convert(selectedPaths);
            }
            return pixel.copy(selectedPaths);
          }}
          disabled={pixel.isRunning}
          className="gap-2"
        >
          {pixel.isRunning ? (
            <Spinner size={18} className="animate-spin" />
          ) : (
            <Play size={18} weight="fill" />
          )}
          {pixel.isRunning
            ? mediaJob === 'convert'
              ? 'Converting…'
              : 'Copying…'
            : mediaJob === 'convert'
              ? 'Convert Media'
              : 'Copy Media'}
        </Button>
        <Button
          type="button"
          variant="outline"
          title="Restore EXIF or Takeout timestamps"
          onClick={() => pixel.fixDates(selectedPaths)}
          disabled={pixel.isRunning}
          className="gap-2"
        >
          <Clock size={18} weight="duotone" />
          Fix Dates
        </Button>
      </div>

      <ConversionStatsPanel />
    </>
  );
};

export default ConvertFiles;
