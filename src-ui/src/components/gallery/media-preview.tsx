import { useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { Command } from '@tauri-apps/plugin-shell';
import {
  IconArrowsMaximize,
  IconFolderOpen,
  IconMovie,
  IconTrash,
} from '@tabler/icons-react';
import { toast } from 'sonner';
import type { GalleryScanFilePayload } from '@cli-protocol';
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
import { isImagePath } from '@/lib/gallery-scan';
import { cn } from '@/lib/utils';

interface MediaPreviewProps {
  readonly file: GalleryScanFilePayload;
  /** Called after the file is successfully moved to the Trash. */
  readonly onTrashed?: (path: string) => void;
  /** When provided, renders an "expand" button (e.g. to open a Lightbox). */
  readonly onExpand?: () => void;
  /** Extra classes for the media frame (sizing differs inline vs. dialog). */
  readonly mediaClassName?: string;
}

async function revealInFinder(filePath: string): Promise<void> {
  await Command.create('open', ['-R', filePath]).execute();
}

const MediaPreview: React.FC<MediaPreviewProps> = ({
  file,
  onTrashed,
  onExpand,
  mediaClassName,
}) => {
  const [confirmTrash, setConfirmTrash] = useState(false);
  const [isTrashing, setIsTrashing] = useState(false);

  const src = convertFileSrc(file.path);
  const showImage = isImagePath(file.path);

  const handleTrash = async () => {
    setIsTrashing(true);
    try {
      const result = await Command.create('trash', [file.path]).execute();
      if (result.code !== 0) {
        throw new Error(result.stderr.trim() || `Exit code ${result.code}`);
      }
      toast.success(`Moved “${file.basename}” to Trash`);
      onTrashed?.(file.path);
      setConfirmTrash(false);
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
      <div
        className={cn(
          'flex min-h-[240px] items-center justify-center overflow-hidden rounded-lg border bg-muted/30',
          mediaClassName,
        )}
      >
        {showImage ? (
          <img
            src={src}
            alt={file.basename}
            className="max-h-full max-w-full object-contain"
          />
        ) : file.mediaKind === 'video' ? (
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
        {onExpand ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto gap-2"
            onClick={onExpand}
          >
            <IconArrowsMaximize size={16} />
            Expand
          </Button>
        ) : null}
      </div>

      <AlertDialog open={confirmTrash} onOpenChange={setConfirmTrash}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              “{file.basename}” will be moved to the macOS Trash. You can recover
              it from there.
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

export default MediaPreview;
