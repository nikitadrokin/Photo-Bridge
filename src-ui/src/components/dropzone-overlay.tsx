import { UploadSimple } from '@phosphor-icons/react';

interface DropzoneOverlayProps {
  isVisible: boolean;
  extensions: Array<string>;
}

const DropzoneOverlay: React.FC<DropzoneOverlayProps> = ({
  isVisible,
  extensions,
}) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-xl">
      {/* Animated background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-96 w-96 rounded-full bg-primary/10 blur-3xl animate-pulse" />
      </div>

      <div className="relative flex flex-col items-center gap-5 p-16 border-2 border-dashed border-primary/40 rounded-3xl bg-primary/5 backdrop-blur-sm">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <UploadSimple
            size={40}
            className="text-primary animate-bounce"
            weight="duotone"
          />
        </div>
        <div className="text-center">
          <p className="text-xl font-semibold text-foreground mb-1">
            Drop to import
          </p>
          <p className="text-sm text-muted-foreground">
            Supports {extensions.slice(0, 6).join(', ')}
            {extensions.length > 6 ? ` and ${extensions.length - 6} more` : ''}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DropzoneOverlay;
