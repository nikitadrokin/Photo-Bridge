import { convertFileSrc } from '@tauri-apps/api/core';
import type { PixelFilePayload } from '@cli-protocol';
import {
  IconAlertTriangle,
  IconArrowsMaximize,
  IconDownload,
  IconLoader2,
  IconMovie,
} from '@tabler/icons-react';
import { Button } from '@/components/ui/button';
import { VIDEO_EXTENSIONS } from '@/lib/constants';
import { isImagePath } from '@/lib/gallery-scan';
import { cn } from '@/lib/utils';

export type PixelPreviewStatus = 'loading' | 'ready' | 'error';

interface PixelMediaPreviewProps {
  readonly file: PixelFilePayload;
  readonly status: PixelPreviewStatus;
  /** Local path of the pulled copy; present once `status === 'ready'`. */
  readonly localPath: string | null;
  readonly errorDetail?: string | null;
  readonly onSave?: () => void;
  readonly onExpand?: () => void;
  readonly mediaClassName?: string;
}

const PixelMediaPreview: React.FC<PixelMediaPreviewProps> = ({
  file,
  status,
  localPath,
  errorDetail,
  onSave,
  onExpand,
  mediaClassName,
}) => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isVideo = VIDEO_EXTENSIONS.includes(ext);
  const isImage = isImagePath(file.name);
  const src = localPath ? convertFileSrc(localPath) : null;

  return (
    <>
      <div
        className={cn(
          'flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30',
          mediaClassName,
        )}
      >
        {status === 'loading' ? (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <IconLoader2 size={28} className="animate-spin" />
            <p className="text-sm">Pulling from device…</p>
          </div>
        ) : status === 'error' ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center text-muted-foreground">
            <IconAlertTriangle size={28} className="text-destructive" />
            <p className="text-sm">Could not load preview</p>
            {errorDetail ? (
              <p className="text-xs text-muted-foreground">{errorDetail}</p>
            ) : null}
          </div>
        ) : src && isImage ? (
          <img
            src={src}
            alt={file.name}
            className="max-h-full max-w-full object-contain"
          />
        ) : src && isVideo ? (
          <video
            src={src}
            controls
            className="max-h-full max-w-full"
            preload="metadata"
          />
        ) : (
          <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
            <IconMovie size={40} />
            <p className="text-sm">Preview not available for this format</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={onSave}
        >
          <IconDownload size={16} />
          Save to…
        </Button>
        {onExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-2"
            disabled={status !== 'ready'}
            onClick={onExpand}
          >
            <IconArrowsMaximize size={16} />
            Expand
          </Button>
        ) : null}
      </div>
    </>
  );
};

export default PixelMediaPreview;
