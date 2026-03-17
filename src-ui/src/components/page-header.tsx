import type { ReactNode } from 'react';
import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import useIsFullscreen from '@/hooks/use-is-fullscreen';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const { open: sidebarOpen } = useSidebar();
  const isMobile = useIsMobile();
  const isFullscreen = useIsFullscreen();

  return (
    <header
      className={cn(
        'sticky top-0 z-10 shrink-0 border-b border-border bg-background/80 backdrop-blur-lg px-6 py-3 transition-[padding] duration-200 ease-in-out',
        !isFullscreen && (!sidebarOpen || isMobile) && 'pl-26',
      )}
    >
      <div className="flex items-start gap-3">
        <SidebarTrigger className="-ml-2 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {children ? (
              <div className="flex items-center gap-2 shrink-0">{children}</div>
            ) : null}
          </div>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
