import type { GalleryScanFilePayload } from '@cli-protocol';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import MediaPreview from '@/components/gallery/media-preview';
import { formatGalleryCaptureTime } from '@/lib/gallery-scan';

interface LightboxProps {
  readonly file: GalleryScanFilePayload | null;
  readonly open: boolean;
  readonly onClose: () => void;
  /** Called after a file is successfully moved to the Trash. */
  readonly onTrashed?: (path: string) => void;
}

const Lightbox: React.FC<LightboxProps> = ({
  file,
  open,
  onClose,
  onTrashed,
}) => {
  const timeLabel = file ? formatGalleryCaptureTime(file.unixSeconds) : '';

  return (
    <Dialog
      open={open && file !== null}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        {file ? (
          <>
            <DialogHeader>
              <DialogTitle className="truncate pr-8">
                {file.basename}
              </DialogTitle>
              <DialogDescription className="truncate">
                {timeLabel ? `Captured ${timeLabel} UTC · ` : ''}
                {file.path}
              </DialogDescription>
            </DialogHeader>

            <MediaPreview
              file={file}
              onTrashed={(path) => {
                onTrashed?.(path);
                onClose();
              }}
              mediaClassName="max-h-[70vh]"
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};

export default Lightbox;
