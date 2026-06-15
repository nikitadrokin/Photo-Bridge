import { convertFileSrc } from '@tauri-apps/api/core';
import type { GalleryScanDayPayload, GalleryScanFilePayload } from '@cli-protocol';
import { IconMovie, IconPhoto } from '@tabler/icons-react';
import {
  formatGalleryCaptureTime,
  formatGalleryDayTitle,
} from '@/lib/gallery-scan';
import { IMAGE_EXTENSIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface DayTimelineProps {
  readonly days: readonly GalleryScanDayPayload[];
  readonly onSelectFile: (file: GalleryScanFilePayload) => void;
}

function isImagePath(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

interface GalleryThumbProps {
  readonly file: GalleryScanFilePayload;
  readonly onSelect: () => void;
}

function GalleryThumb({ file, onSelect }: GalleryThumbProps) {
  const src = convertFileSrc(file.path);
  const timeLabel = formatGalleryCaptureTime(file.unixSeconds);
  const isImage = isImagePath(file.path);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'group relative aspect-square overflow-hidden rounded-md border bg-muted/40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      )}
      title={file.basename}
    >
      {isImage ? (
        <img
          src={src}
          alt={file.basename}
          loading="lazy"
          className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 bg-muted/60 text-muted-foreground">
          {file.mediaKind === 'video' ? (
            <IconMovie size={28} />
          ) : (
            <IconPhoto size={28} />
          )}
          <span className="max-w-full truncate px-2 text-[10px]">
            {file.basename}
          </span>
        </div>
      )}
      {timeLabel ? (
        <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {timeLabel}
        </span>
      ) : null}
    </button>
  );
}

const DayTimeline: React.FC<DayTimelineProps> = ({ days, onSelectFile }) => {
  return (
    <div className="flex flex-col gap-10 pb-8">
      {days.map((day) => (
        <section key={day.dayKey} className="flex flex-col gap-3">
          <div className="sticky top-0 z-10 -mx-1 border-b bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <h2 className="text-base font-semibold tracking-tight">
              {formatGalleryDayTitle(day.dayKey)}
            </h2>
            <p className="text-xs text-muted-foreground">
              {day.files.length} file{day.files.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {day.files.map((file) => (
              <GalleryThumb
                key={file.path}
                file={file}
                onSelect={() => {
                  onSelectFile(file);
                }}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default DayTimeline;
