import { cn } from '@/lib/utils';

interface SplitColumnProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Lock the grid to the viewport height so inner panes handle their own
   * scrolling (file tree / gallery pages). Without it the page grows with its
   * content and SidebarInset scrolls the whole page.
   */
  fillHeight?: boolean;
}

const SplitColumn: React.FC<SplitColumnProps> = ({
  children,
  className,
  fillHeight = false,
}) => {
  return (
    <main
      className={cn(
        'flex-1 p-4 mx-auto w-full grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8',
        fillHeight && 'h-full',
        className,
      )}
    >
      {children}
    </main>
  );
};

export default SplitColumn;
