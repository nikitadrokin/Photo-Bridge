import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import { IconFolderOpen, IconMovie, IconTrash } from '@tabler/icons-react';
import { toast } from 'sonner';
import type { GalleryScanFilePayload } from '@cli-protocol';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { formatGalleryCaptureTime, isImagePath } from '@/lib/gallery-scan';

interface LightboxProps {
  readonly file: GalleryScanFilePayload | null;
  readonly onClose: () => void;
  /** Called after a file is successfully moved to the Trash. */
  readonly onTrashed?: (path: string) => void;
}

async function revealInFinder(filePath: string): Promise<void> {
  await Command.create('open', ['-R', filePath]).execute();
}

const Lightbox: React.FC<LightboxProps> = ({ file, onClose, onTrashed }) => {
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [isTrashing, setIsTrashing] = useState(false);

  const open = file !== null;
  const src = file ? convertFileSrc(file.path) : '';
  const showImage = file ? isImagePath(file.path) : false;
  const timeLabel = file ? formatGalleryCaptureTime(file.unixSeconds) : '';

  const handleTrash = async () => {
    if (!file) return;
    setIsTrashing(true);
    try {
      const result = await Command.create('trash', [file.path]).execute();
      if (result.code !== 0) {
        throw new Error(result.stderr.trim() || `Exit code ${result.code}`);
      }
      toast.success(`Moved “${file.basename}” to Trash`);
      onTrashed?.(file.path);
      setConfirmTrash(false);
      onClose();
    } catch (error) {
      toast.error('Could not move file to Trash', {
        description:
          error instanceof Error
            ? `${error.message} — is the \`trash\` CLI installed? (brew install trash)`
            : 'Is the `trash` CLI installed? (brew install trash)',
      });
    } finally {
      setIsTrashing(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
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

              <div className="flex max-h-[70vh] min-h-[240px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
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
                  <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                    <IconMovie size={40} />
                    <p className="text-sm">
                      Preview not available for this format
                    </p>
                  </div>
                )}
              </div>

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    void revealInFinder(file.path);
                  }}
                >
                  <IconFolderOpen size={16} />
                  Open in Finder
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => {
                    setConfirmTrash(true);
                  }}
                >
                  <IconTrash size={16} />
                  Move to Trash
                </Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmTrash} onOpenChange={setConfirmTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              “{file?.basename}” will be moved to the macOS Trash. You can
              recover it from there.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isTrashing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isTrashing}
              onClick={() => {
                void handleTrash();
              }}
            >
              {isTrashing ? 'Moving…' : 'Move to Trash'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Lightbox;
