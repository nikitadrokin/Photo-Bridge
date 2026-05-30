import { convertFileSrc } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { FilmStrip, FolderOpen } from '@phosphor-icons/react';
import type { GalleryScanFilePayload } from '@cli-protocol';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { formatGalleryCaptureTime } from '@/lib/gallery-scan';
import { IMAGE_EXTENSIONS } from '@/lib/constants';

interface MediaPreviewSheetProps {
  readonly file: GalleryScanFilePayload | null;
  readonly onClose: () => void;
}

function isImagePath(filePath: string): boolean {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_EXTENSIONS.includes(ext);
}

async function revealInFinder(filePath: string): Promise<void> {
  await Command.create('open', ['-R', filePath]).execute();
}

const MediaPreviewSheet: React.FC<MediaPreviewSheetProps> = ({
  file,
  onClose,
}) => {
  const open = file !== null;
  const src = file ? convertFileSrc(file.path) : '';
  const showImage = file ? isImagePath(file.path) : false;
  const timeLabel = file ? formatGalleryCaptureTime(file.unixSeconds) : '';

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose();
        }
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-xl">
        {file ? (
          <>
            <SheetHeader>
              <SheetTitle className="truncate pr-8">{file.basename}</SheetTitle>
              <SheetDescription className="truncate">{file.path}</SheetDescription>
            </SheetHeader>

            <div className="mt-4 flex min-h-0 flex-1 flex-col gap-4">
              <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {showImage ? (
                  <img
                    src={src}
                    alt={file.basename}
                    className="max-h-[70vh] max-w-full object-contain"
                  />
                ) : file.mediaKind === 'video' ? (
                  <video
                    src={src}
                    controls
                    className="max-h-[70vh] max-w-full"
                    preload="metadata"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <FilmStrip size={40} weight="duotone" />
                    <p className="text-sm">Preview not available for this format</p>
                  </div>
                )}
              </div>

              {timeLabel ? (
                <p className="text-sm text-muted-foreground">Captured {timeLabel} UTC</p>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="w-fit gap-2"
                onClick={() => {
                  void revealInFinder(file.path);
                }}
              >
                <FolderOpen size={18} weight="duotone" />
                Show in Finder
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
};

export default MediaPreviewSheet;
