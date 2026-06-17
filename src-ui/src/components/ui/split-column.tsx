import { cn } from '@/lib/utils';

interface SplitColumnProps {
  children: React.ReactNode;
  className?: string;
}

const SplitColumn: React.FC<SplitColumnProps> = ({ children, className }) => {
  return (
    <main
      className={cn(
        'flex-1 p-4 mx-auto size-full grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8',
        className,
      )}
    >
      {children}
    </main>
  );
};

export default SplitColumn;
