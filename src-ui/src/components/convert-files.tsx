import {
  IconFile,
  IconLoader2,
  IconPlayerPlay,
  IconX,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useMediaStore } from '@/stores/media-store';
import { type CopyWriteMode, usePixel } from '@/hooks/use-pixel';
import { Button } from '@/components/ui/button';
import { ChoiceCardRadioGroup } from '@/components/ui/choice-card';
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
import Code from './ui/inline-code';

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
  const [writeMode, setWriteMode] = useState<CopyWriteMode>('copy-directory');
  const editInPlace = writeMode === 'overwrite';

  return (
    <>
      {/* Selected files bar */}
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <IconFile size={16} className="text-primary" />
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
          <IconX size={16} />
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

      {mediaJob === 'copy' && (
        <FieldSet className="max-w-full gap-3">
          <FieldLegend variant="label">Write mode</FieldLegend>
          <FieldLabel htmlFor="copy-overwrite-original" className="w-full">
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>Overwrite converted files</FieldTitle>
                <FieldDescription>
                  {editInPlace ? (
                    'Overwrite files such as .MOV files to .MP4.'
                  ) : (
                    <>
                      Preserve files by writing to a{' '}
                      <Code variant="muted">_Copied</Code> folder.
                    </>
                  )}
                </FieldDescription>
              </FieldContent>
              <Switch
                id="copy-overwrite-original"
                checked={editInPlace}
                onCheckedChange={(checked) =>
                  setWriteMode(checked ? 'overwrite' : 'copy-directory')
                }
                disabled={pixel.isRunning}
              />
            </Field>
          </FieldLabel>
        </FieldSet>
      )}

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
          return pixel.copy(selectedPaths, { writeMode });
        }}
        disabled={pixel.isRunning}
        className="w-fit gap-2"
      >
        {pixel.isRunning ? (
          <IconLoader2 size={18} className="animate-spin" />
        ) : (
          <IconPlayerPlay size={18} />
        )}
        {pixel.isRunning
          ? mediaJob === 'convert'
            ? 'Converting…'
            : 'Copying…'
          : mediaJob === 'convert'
            ? 'Convert Media'
            : 'Copy Media'}
      </Button>
    </>
  );
};

export default ConvertFiles;
