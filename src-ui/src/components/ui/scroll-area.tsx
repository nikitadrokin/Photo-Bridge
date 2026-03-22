import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type ScrollAreaProps = {
  children: React.ReactNode;
  className?: string;
  gradientHeightTop?: string;
  gradientHeightBottom?: string;
  gradientColor?: string;
};

const ScrollArea: React.FC<ScrollAreaProps> = ({
  children,
  className,
  gradientHeightTop = '1rem',
  gradientHeightBottom = '1rem',
  gradientColor = 'var(--card)',
}) => {
  const isMobile = useIsMobile();

  return (
    <div
      className={cn(
        'in-[**]:overflow-hidden overflow-y-auto overscroll-y-none flex flex-col relative',
        'before:absolute before:rounded-t-3xl md:before:rounded-t-none before:inset-x-0 before:top-0 before:z-10 before:h-(--gradient-height-top) before:bg-linear-to-b before:from-(--gradient-color) before:to-transparent before:content-[""]',
        'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:z-10 after:h-(--gradient-height-bottom) after:bg-linear-to-t after:from-(--gradient-color) after:to-transparent after:content-[""]',
        isMobile
          ? 'h-full min-h-0 [&>*:first-child]:pt-(--gradient-height-top) [&>*:last-child]:pb-(--gradient-height-bottom)'
          : '',
        className,
      )}
      style={
        {
          '--gradient-height-top': gradientHeightTop,
          '--gradient-height-bottom': gradientHeightBottom,
          '--gradient-color': gradientColor,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
};

export default ScrollArea;
