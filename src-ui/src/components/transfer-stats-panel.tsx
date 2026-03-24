import { type ReactNode, useMemo } from 'react';
import {
  CheckCircle,
  Clock,
  MinusCircle,
  Stack,
  XCircle,
} from '@phosphor-icons/react';
import { buildAlertRows } from '@/lib/activity-format';
import { cn } from '@/lib/utils';
import { usePixel } from '@/hooks/use-pixel';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

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
  <Card
    size="sm"
    className={cn(
      'min-w-0 border bg-muted/20 py-2.5',
      className,
    )}
  >
    <CardContent className="px-3">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        <span className="shrink-0 opacity-80">{icon}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide truncate">
          {label}
        </span>
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
    </CardContent>
  </Card>
);

const TransferStatsPanel: React.FC = () => {
  const { activityEvents, isRunning, activeOperation } = usePixel();

  const lastProgress = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const event = activityEvents[i];
      if (event.kind === 'progress') {
        return event;
      }
    }
    return null;
  }, [activityEvents]);

  const alertRows = useMemo(
    () => buildAlertRows(activityEvents),
    [activityEvents],
  );

  const stats = useMemo(() => {
    let info = 0;
    let success = 0;
    let failed = 0;
    for (const event of activityEvents) {
      if (event.kind === 'info') {
        info++;
      } else if (event.kind === 'success') {
        success++;
      } else if (event.kind === 'error') {
        failed++;
      }
    }
    return { info, success, failed };
  }, [activityEvents]);

  const hasProgress = lastProgress != null && lastProgress.total > 0;
  const hasAlerts = alertRows.length > 0;
  const opLabel =
    activeOperation === 'push'
      ? 'Pushing to Pixel'
      : activeOperation === 'pull'
        ? 'Pulling from Pixel'
        : 'Transfer Progress';

  return (
    <Card className="gap-3 rounded-3xl border bg-card/50">
      <CardHeader className="flex items-center justify-between gap-2 min-w-0 pb-0">
        <p className="text-xs font-medium text-muted-foreground truncate">
          {opLabel}
        </p>
        {hasProgress ? (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {lastProgress.done}/{lastProgress.total}
          </span>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-3">

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

        <div className="grid grid-cols-4 gap-2">
          <StatCard
            label="Total"
            value={
              hasProgress
                ? String(lastProgress.total)
                : isRunning
                  ? '—'
                  : String(stats.info + stats.success + stats.failed)
            }
            icon={<Stack size={13} weight="duotone" />}
          />
          <StatCard
            label="Items"
            value={String(stats.info)}
            icon={<Clock size={13} weight="duotone" className="text-primary" />}
          />
          <StatCard
            label="Done"
            value={String(stats.success)}
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
            label="Failed"
            value={String(stats.failed)}
            icon={
              stats.failed > 0 ? (
                <XCircle
                  size={13}
                  weight="duotone"
                  className="text-destructive"
                />
              ) : (
                <MinusCircle
                  size={13}
                  weight="duotone"
                  className="text-muted-foreground"
                />
              )
            }
            className={cn(
              stats.failed === 0 && 'opacity-70',
              stats.failed > 0 && 'border-destructive/20 bg-destructive/5',
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default TransferStatsPanel;
