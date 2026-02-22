import type React from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

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
        'group relative flex w-full cursor-pointer flex-col items-start text-left transition-colors duration-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      disabled={disabled}
      {...props}
    >
      <Card className="h-full w-full p-4 overflow-hidden border-border/50 bg-background/50 backdrop-blur-sm transition-colors duration-150 hover:border-primary/50 hover:bg-accent/40 hover:shadow-sm">
        <CardContent className="flex flex-col gap-2 p-0">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20',
              variant === 'destructive' &&
                'bg-destructive/10 group-hover:bg-destructive/20',
            )}
          >
            <div
              className={cn(
                'text-primary',
                variant === 'destructive' && 'text-destructive',
              )}
            >
              {icon}
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold leading-none tracking-tight text-foreground transition-colors group-hover:text-primary">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </CardContent>
      </Card>

      {/* Decorative gradient blob behind the card (optional, adds premium feel) */}
      <div className="absolute -inset-px -z-10 rounded-xl bg-linear-to-br from-primary/20 to-transparent opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-50" />
    </button>
  );
}
