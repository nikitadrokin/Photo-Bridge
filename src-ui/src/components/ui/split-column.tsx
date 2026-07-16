import { cn } from '@/lib/utils';

interface SplitColumnProps {
  children: React.ReactNode;
  className?: string;
  containerRef?: React.Ref<HTMLElement>;
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
  containerRef,
  fillHeight = false,
}) => {
  return (
    <main
      ref={containerRef}
      className={cn(
        '@container/split flex-1 p-4 mx-auto w-full max-w-6xl',
        fillHeight && 'h-full',
        className,
      )}
    >
      <div
        className={cn(
          'grid h-full w-full grid-cols-1 gap-8 @min-[64rem]/split:grid-cols-2',
          fillHeight && 'min-h-0',
        )}
      >
        {children}
      </div>
    </main>
  );
};

export default SplitColumn;
