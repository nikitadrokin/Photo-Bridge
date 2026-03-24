import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ActionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'primary' | 'destructive';
  /** Wide stacked layout with larger icon slot for primary flows */
  size?: 'default' | 'prominent';
  /** Filled card vs outline utility row */
  appearance?: 'card' | 'ghost';
}

export function ActionCard({
  icon,
  title,
  description,
  className,
  variant = 'default',
  size = 'default',
  appearance = 'card',
  disabled,
  ...props
}: ActionCardProps) {
  const iconWrapClass = cn(
    'flex shrink-0 items-center justify-center rounded-xl transition-colors duration-200',
    size === 'prominent' ? 'h-12 w-12' : 'h-10 w-10',
    variant === 'destructive'
      ? 'bg-destructive/10 text-destructive group-hover:bg-destructive/15'
      : 'bg-primary/10 text-primary group-hover:bg-primary/15',
  );

  if (appearance === 'ghost') {
    return (
      <button
        className={cn(
          'group relative flex w-full cursor-pointer flex-row items-center gap-3 rounded-lg border border-border/70 bg-transparent px-4 py-3.5 text-left transition-colors duration-150 hover:border-foreground/20 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        disabled={disabled}
        {...props}
      >
        <div className={iconWrapClass}>{icon}</div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h3 className="text-sm font-medium tracking-tight text-foreground">
            {title}
          </h3>
          <p className="text-[11px] leading-snug text-muted-foreground/65">
            {description}
          </p>
        </div>
      </button>
    );
  }

  return (
    <button
      className={cn(
        'group relative flex w-full cursor-pointer flex-col items-start text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <div
        className={cn(
          'h-full w-full rounded-xl border bg-card transition-colors duration-150 hover:border-foreground/15 hover:bg-accent/30',
          size === 'prominent' ? 'p-6' : 'p-5',
        )}
      >
        <div className="flex flex-col gap-4">
          <div className={iconWrapClass}>{icon}</div>
          <div className="space-y-1">
            <h3
              className={cn(
                'font-semibold tracking-tight text-foreground',
                size === 'prominent' ? 'text-base' : 'text-sm',
              )}
            >
              {title}
            </h3>
            <p className="text-[11px] leading-snug text-muted-foreground/70">
              {description}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
