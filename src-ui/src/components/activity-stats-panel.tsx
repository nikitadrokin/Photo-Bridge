import { type ReactNode, useMemo } from 'react';
import {
  CheckCircle,
  MinusCircle,
  Stack,
  XCircle,
} from '@phosphor-icons/react';
import { buildAlertRows, deriveActivityStats } from '@/lib/activity-format';
import { cn } from '@/lib/utils';
import { usePixel } from '@/contexts/pixel-context';

interface StatCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  className?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  className,
}) => (
  <div
    className={cn(
      'rounded-xl border bg-muted/20 px-3 py-2.5 min-w-0',
      className,
    )}
  >
    <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
      <span className="shrink-0 opacity-80">{icon}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide truncate">
        {label}
      </span>
    </div>
    <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
      {value}
    </p>
  </div>
);

/**
 * Progress, stat cards, and warning/error banners for convert/copy — sits under action buttons.
 */
const ActivityStatsPanel: React.FC = () => {
  const { activityEvents, isRunning } = usePixel();

  const stats = useMemo(
    () => deriveActivityStats(activityEvents),
    [activityEvents],
  );

  const lastProgress = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const e = activityEvents[i];
      if (e.kind === 'progress') return e;
    }
    return null;
  }, [activityEvents]);

  const alertRows = useMemo(
    () => buildAlertRows(activityEvents),
    [activityEvents],
  );

  const hasSession = activityEvents.some(
    (e) => e.kind === 'session' && e.phase === 'start',
  );
  const showStats =
    hasSession || stats.added + stats.skipped + stats.failed > 0;
  const hasAlerts = alertRows.length > 0;
  const hasProgress = lastProgress != null && lastProgress.total > 0;

  if (!showStats && !hasAlerts && !hasProgress && !stats.subtitle) {
    return null;
  }

  const totalDisplay =
    stats.total != null ? String(stats.total) : isRunning ? '—' : '0';

  return (
    <div className="flex flex-col gap-3 rounded-3xl border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">
          {stats.subtitle ?? 'Progress'}
        </p>
        {hasProgress ? (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {lastProgress.done}/{lastProgress.total}
          </span>
        ) : null}
      </div>

      {hasProgress ? (
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-[width] duration-300 ease-out"
            style={{
              width: `${Math.min(100, Math.round((lastProgress.done / lastProgress.total) * 100))}%`,
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

      {showStats ? (
        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Total"
            value={totalDisplay}
            icon={<Stack size={13} weight="duotone" />}
          />
          <StatCard
            label="Added"
            value={String(stats.added)}
            icon={
              <CheckCircle
                size={13}
                weight="duotone"
                className="text-emerald-600 dark:text-emerald-400"
              />
            }
            className="border-emerald-500/15"
          />
          <StatCard
            label="Skipped"
            value={String(stats.skipped)}
            icon={
              <MinusCircle
                size={13}
                weight="duotone"
                className="text-muted-foreground"
              />
            }
          />
          <StatCard
            label="Failed"
            value={String(stats.failed)}
            icon={
              <XCircle
                size={13}
                weight="duotone"
                className="text-destructive"
              />
            }
            className={cn(
              stats.failed === 0 && 'opacity-70',
              stats.failed > 0 && 'border-destructive/20 bg-destructive/5',
            )}
          />
        </div>
      ) : null}
    </div>
  );
};

export default ActivityStatsPanel;
