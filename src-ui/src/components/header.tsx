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
      data-tauri-drag-region
      className={cn(
        'z-10 shrink-0 border-b mx-2 border-border bg-background/80 backdrop-blur-lg px-4 py-3 transition-[padding] duration-200 ease-in-out',
        !isFullscreen && (!sidebarOpen || isMobile) && 'pl-26',
      )}
    >
      <div className="flex items-start gap-3" data-tauri-drag-region>
        <SidebarTrigger className="-ml-2 mt-0.5" />
        <div className="flex-1 min-w-0" data-tauri-drag-region>
          <div
            className="flex items-center justify-between gap-4"
            data-tauri-drag-region
          >
            <h1
              className="text-2xl font-semibold tracking-tight"
              data-tauri-drag-region
            >
              {title}
            </h1>
            {children ? (
              <div
                className="flex items-center gap-2 shrink-0"
                data-tauri-drag-region
              >
                {children}
              </div>
            ) : null}
          </div>
          {description ? (
            <p
              className="mt-1 text-sm text-muted-foreground"
              data-tauri-drag-region
            >
              {description}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
