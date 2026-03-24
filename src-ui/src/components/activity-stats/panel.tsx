import { useMemo } from 'react';
import {
  CheckCircle,
  MinusCircle,
  Stack,
  XCircle,
} from '@phosphor-icons/react';
import { buildAlertRows, deriveActivityStats } from '@/lib/activity-format';
import { cn } from '@/lib/utils';
import { usePixel } from '@/hooks/use-pixel';
import StatsPanel from './conversion-panel';
import StatCard from './card';

/**
 * Progress, stat cards, and warning/error banners for the convert/copy page.
 * Reads from usePixel() internally — no props needed.
 */
const ConversionStatsPanel: React.FC = () => {
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

  if (
    !showStats &&
    alertRows.length === 0 &&
    !lastProgress &&
    !stats.subtitle
  ) {
    return null;
  }

  const totalDisplay =
    stats.total != null ? String(stats.total) : isRunning ? '—' : '0';

  return (
    <StatsPanel
      subtitle={stats.subtitle}
      progress={lastProgress}
      alertRows={alertRows}
    >
      {showStats ? (
        <>
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
        </>
      ) : null}
    </StatsPanel>
  );
};

export default ConversionStatsPanel;
