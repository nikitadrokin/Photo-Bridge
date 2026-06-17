import { cn } from '@/lib/utils';

interface EmptyDropzoneProps {
  isDragging?: boolean;
  children: React.ReactNode;
}

const EmptyDropzone: React.FC<EmptyDropzoneProps> = ({
  isDragging,
  children,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border-2 border-dashed m-1 grow py-16 px-8 text-center transition-colors duration-200 col-span-full',
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
