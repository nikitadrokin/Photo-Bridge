import { useMemo } from 'react';
import { CheckCircle, Stack, XCircle } from '@phosphor-icons/react';
import { buildAlertRows } from '@/lib/activity-format';
import { usePixel } from '@/hooks/use-pixel';
import { cn } from '@/lib/utils';
import StatsPanel from '@/components/activity-stats/panel';
import StatCard from '@/components/activity-stats/card';

/**
 * Progress, stat cards, and warning/error banners for the transfer page.
 * Reads from usePixel() internally — no props needed.
 */
const TransferStatsPanel: React.FC = () => {
  const { activityEvents, isRunning, activeOperation } = usePixel();

  const lastTransferBytes = useMemo(() => {
    for (let i = activityEvents.length - 1; i >= 0; i--) {
      const event = activityEvents[i];
      if (event.kind === 'push_bytes' || event.kind === 'pull_bytes') {
        return event;
      }
    }
    return null;
  }, [activityEvents]);

  const pushedVsPulledLabel =
    lastTransferBytes?.kind === 'pull_bytes' ? 'Pulled' : 'Pushed';

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
      } else if (event.kind === 'push_bytes' || event.kind === 'pull_bytes') {
        lastCompletedFiles = event.completedFiles;
        lastTotalFiles = event.totalFiles;
      }
    }

    if (lastTotalFiles > 0) {
      return {
        success: lastCompletedFiles,
        failed,
        total: lastTotalFiles,
      };
    }

    return { success, failed, total: null };
  }, [activityEvents]);

  const hasProgressFromFiles = lastProgress != null && lastProgress.total > 0;
  const hasProgressFromBytes =
    lastTransferBytes != null && lastTransferBytes.totalFiles > 0;
  const progressDone = hasProgressFromFiles
    ? lastProgress.done
    : hasProgressFromBytes
      ? (lastTransferBytes?.completedFiles ?? 0)
      : 0;
  const progressTotal = hasProgressFromFiles
    ? lastProgress.total
    : hasProgressFromBytes
      ? (lastTransferBytes?.totalFiles ?? 0)
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
        : String(stats.success + stats.failed);

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
        label={pushedVsPulledLabel}
        value={String(stats.success)}
        icon={
          <CheckCircle
            size={13}
            weight="duotone"
            className="text-emerald-600 dark:text-emerald-400"
          />
        }
        className="border-emerald-500/15 bg-emerald-500/5"
      />
      <StatCard
        label="Failed"
        value={String(stats.failed)}
        icon={
          <XCircle
            size={13}
            weight="duotone"
            className={cn(
              stats.failed > 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
          />
        }
        className={cn(
          stats.failed > 0
            ? 'border-destructive/20 bg-destructive/5'
            : 'opacity-70',
        )}
      />
    </StatsPanel>
  );
};

export default TransferStatsPanel;
