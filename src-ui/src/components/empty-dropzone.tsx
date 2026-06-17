import { cn } from '@/lib/utils';
import useIsFullscreen from '@/hooks/use-is-fullscreen';
import { useSidebar } from './ui/sidebar';

interface EmptyDropzoneProps {
  isDragging?: boolean;
  children: React.ReactNode;
}

const EmptyDropzone: React.FC<EmptyDropzoneProps> = ({
  isDragging,
  children,
}) => {
  const isFullscreen = useIsFullscreen();
  const { open } = useSidebar();

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed m-1 grow py-16 px-8 text-center transition-colors duration-200 col-span-full',
        !isFullscreen && open && 'md:rounded-br-md',
        isDragging
          ? 'border-primary bg-primary/10'
          : 'border-border/60 bg-muted/20 hover:border-border hover:bg-muted/30',
      )}
    >
      {children}
    </div>
  );
};

export default EmptyDropzone;
