import { useMemo } from 'react';
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
import StatsPanel from '@/components/activity-stats/conversion-panel';
import StatCard from '@/components/activity-stats/card';

/**
 * Progress, stat cards, and warning/error banners for the transfer page.
 * Reads from usePixel() internally — no props needed.
 */
const TransferStatsPanel: React.FC = () => {
  const { activityEvents, isRunning, activeOperation } = usePixel();

  const lastPushBytes = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const event = activityEvents[i];
      if (event.kind === 'push_bytes') return event;
    }
    return null;
  }, [activityEvents]);

  const lastProgress = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const event = activityEvents[i];
      if (event.kind === 'progress') return event;
    }
    return null;
  }, [activityEvents]);

  const alertRows = useMemo(
    () => buildAlertRows(activityEvents),
    [activityEvents],
  );

  const stats = useMemo(() => {
    let items = 0;
    let success = 0;
    let failed = 0;
    let lastCompletedFiles = 0;
    let lastTotalFiles = 0;

    for (const event of activityEvents) {
      if (event.kind === 'progress') {
        lastCompletedFiles = event.done;
        lastTotalFiles = event.total;
      } else if (event.kind === 'success') {
        success++;
      } else if (event.kind === 'error') {
        failed++;
      } else if (event.kind === 'push_bytes') {
        lastCompletedFiles = event.completedFiles;
        lastTotalFiles = event.totalFiles;
      }
    }

    if (lastTotalFiles > 0) {
      return {
        items: lastCompletedFiles,
        success: lastCompletedFiles,
        failed,
        total: lastTotalFiles,
      };
    }

    return { items, success, failed, total: null };
  }, [activityEvents]);

  const hasProgressFromFiles = lastProgress != null && lastProgress.total > 0;
  const hasProgressFromBytes =
    lastPushBytes != null && lastPushBytes.totalFiles > 0;
  const progressDone = hasProgressFromFiles
    ? lastProgress.done
    : hasProgressFromBytes
      ? (lastPushBytes?.completedFiles ?? 0)
      : 0;
  const progressTotal = hasProgressFromFiles
    ? lastProgress.total
    : hasProgressFromBytes
      ? (lastPushBytes?.totalFiles ?? 0)
      : 0;

  const subtitle =
    activeOperation === 'push'
      ? 'Pushing to Pixel'
      : activeOperation === 'pull'
        ? 'Pulling from Pixel'
        : 'Transfer Progress';

  const totalDisplay =
    stats.total != null
      ? String(stats.total)
      : isRunning
        ? '—'
        : String(stats.items + stats.failed);

  return (
    <StatsPanel
      subtitle={subtitle}
      progress={
        progressTotal > 0 ? { done: progressDone, total: progressTotal } : null
      }
      alertRows={alertRows}
    >
      <StatCard
        label="Total"
        value={totalDisplay}
        icon={<Stack size={13} weight="duotone" />}
      />
      <StatCard
        label="Items"
        value={String(stats.items)}
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
            <XCircle size={13} weight="duotone" className="text-destructive" />
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
    </StatsPanel>
  );
};

export default TransferStatsPanel;
