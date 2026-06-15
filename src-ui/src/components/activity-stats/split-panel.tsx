import { useMemo } from 'react';
import { IconCircleCheck, IconStack2, IconCircleX } from '@tabler/icons-react';
import { buildAlertRows, deriveActivityStats } from '@/lib/activity-format';
import { cn } from '@/lib/utils';
import { usePixel } from '@/hooks/use-pixel';
import StatsPanel from './panel';
import StatCard from './card';

/**
 * Progress and outcome stats for the split page (progress events + session end).
 */
const SplitStatsPanel: React.FC = () => {
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
    (e) => e.kind === 'session' && e.phase === 'start' && e.command === 'split',
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
            icon={<IconStack2 size={13} />}
          />
          <StatCard
            label="Moved"
            value={String(stats.added)}
            icon={
              <IconCircleCheck
                size={13}
                className="text-emerald-600 dark:text-emerald-400"
              />
            }
            className="border-emerald-500/15"
          />
          <StatCard
            label="Failed"
            value={String(stats.failed)}
            icon={
              <IconCircleX
                size={13}
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

export default SplitStatsPanel;
