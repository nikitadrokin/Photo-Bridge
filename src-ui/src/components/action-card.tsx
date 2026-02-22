import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface ActionCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'primary' | 'destructive';
}

export function ActionCard({
  icon,
  title,
  description,
  className,
  variant = 'default',
  disabled,
  ...props
}: ActionCardProps) {
  return (
    <button
      className={cn(
        'group relative flex w-full cursor-pointer flex-col items-start text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 rounded-xl',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <div className="h-full w-full rounded-xl border bg-card p-5 transition-colors duration-150 hover:border-foreground/15 hover:bg-accent/30">
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200',
              variant === 'destructive'
                ? 'bg-destructive/10 text-destructive group-hover:bg-destructive/15'
                : 'bg-primary/10 text-primary group-hover:bg-primary/15',
            )}
          >
            {icon}
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}
