import type { ReactNode } from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import useIsFullscreen from '@/hooks/use-is-fullscreen';
import { cn } from '@/lib/utils';

interface PageHeaderProps extends React.ComponentProps<'header'> {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children, ...props }: PageHeaderProps) {
  const isFullscreen = useIsFullscreen();

  return (
    <header
      data-tauri-drag-region
      className={cn(
        'shrink-0 z-20 bg-sidebar w-full pr-2 py-3 backdrop-blur-lg transition-[padding] duration-200 ease-in-out select-none [-webkit-user-select:none] [-webkit-touch-callout:none]',
        !isFullscreen ? 'pl-26' : 'pl-4',
      )}
      {...props}
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
        </div>
      </div>
    </header>
  );
}
