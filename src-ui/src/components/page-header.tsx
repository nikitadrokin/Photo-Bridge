import type { ReactNode } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import useIsFullscreen from '@/hooks/use-is-fullscreen';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  const { open: sidebarOpen } = useSidebar();
  const isMobile = useIsMobile();
  const isFullscreen = useIsFullscreen();

  return (
    <header
      className={cn(
        'flex h-14 shrink-0 items-center gap-2 px-4 sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/40 transition-[padding] duration-200 ease-in-out',
        !isFullscreen && (!sidebarOpen || isMobile) && 'pl-26',
      )}
    >
      <SidebarTrigger className="-ml-1" />
      <h1 className="flex-1 text-lg font-semibold">{title}</h1>
      {children ? (
        <div className="flex items-center gap-2">{children}</div>
      ) : null}
    </header>
  );
}
