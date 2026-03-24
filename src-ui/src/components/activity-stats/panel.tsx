import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { ActivityRow } from '@/lib/activity-format';

interface StatsPanelProps {
  subtitle?: string | null;
  progress?: { done: number; total: number } | null;
  alertRows?: ActivityRow[];
  children?: ReactNode;
}

/**
 * Shared layout shell for activity/transfer stat panels.
 * Renders the card wrapper, subtitle header, progress bar, alert rows,
 * and a 4-column grid for whatever StatCard children you pass in.
 */
const StatsPanel: React.FC<StatsPanelProps> = ({
  subtitle,
  progress,
  alertRows = [],
  children,
}) => {
  const hasProgress = progress != null && progress.total > 0;
  const hasAlerts = alertRows.length > 0;

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">
          {subtitle ?? 'Progress'}
        </p>
        {hasProgress ? (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {progress.done}/{progress.total}
          </span>
        ) : null}
      </div>

      {hasProgress ? (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: `${Math.min(100, Math.round((progress.done / progress.total) * 100))}%`,
            }}
          />
        </div>
      ) : null}

      {hasAlerts ? (
        <div className="max-h-36 overflow-y-auto overscroll-y-none space-y-2 pr-1">
          {alertRows.map((row) => (
            <div
              key={row.key}
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-xs leading-snug',
                row.tone === 'error' &&
                  'border-destructive/30 bg-destructive/5 text-destructive',
                row.tone === 'warn' &&
                  'border-amber-500/25 bg-amber-500/5 text-amber-700 dark:text-amber-400',
              )}
            >
              {row.text}
            </div>
          ))}
        </div>
      ) : null}

      {children ? (
        <div className="grid grid-cols-4 gap-2">{children}</div>
      ) : null}
    </div>
  );
};

export default StatsPanel;
