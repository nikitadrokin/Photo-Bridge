import { useEffect, useMemo, useState } from 'react';
import {
  IconCircleCheck,
  IconCircleMinus,
  IconStack2,
  IconCircleX,
  IconFolderOpen,
} from '@tabler/icons-react';
import { buildAlertRows, deriveActivityStats } from '@/lib/activity-format';
import { getLastConvertOutput } from '@/lib/job-output';
import { revealInFinder } from '@/lib/reveal-in-finder';
import { cn } from '@/lib/utils';
import { usePixel } from '@/hooks/use-pixel';
import { Button } from '@/components/ui/button';
import StatsPanel from './panel';
import StatCard from './card';

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

/**
 * Progress, stat cards, and warning/error banners for the convert/copy page.
 * Reads from usePixel() internally — no props needed.
 */
const ConversionStatsPanel: React.FC = () => {
  const { activityEvents, isRunning } = usePixel();
  const [openFolderError, setOpenFolderError] = useState<string | null>(null);

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

  const jobOutput = useMemo(
    () => getLastConvertOutput(activityEvents),
    [activityEvents],
  );

  // Clear Finder open errors when a new job starts or the output changes.
  useEffect(() => {
    setOpenFolderError(null);
  }, [isRunning, jobOutput?.outputDir]);

  const hasSession = activityEvents.some(
    (e) => e.kind === 'session' && e.phase === 'start',
  );
  const showStats =
    hasSession || stats.added + stats.skipped + stats.failed > 0;

  if (
    !showStats &&
    alertRows.length === 0 &&
    !lastProgress &&
    !stats.subtitle &&
    !jobOutput
  ) {
    return null;
  }

  const totalDisplay =
    stats.total != null ? String(stats.total) : isRunning ? '—' : '0';

  const showOpenFolder =
    !isRunning &&
    jobOutput != null &&
    (jobOutput.processed > 0 || jobOutput.skipped > 0);

  const finishedLabel =
    jobOutput?.command === 'copy' ? 'Copy finished' : 'Convert finished';

  return (
    <div className="flex flex-col gap-3">
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
              label="Added"
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
              label="Skipped"
              value={String(stats.skipped)}
              icon={
                <IconCircleMinus size={13} className="text-muted-foreground" />
              }
            />
            <StatCard
              label="Failed"
              value={String(stats.failed)}
              icon={
                <IconCircleX size={13} className="text-destructive" />
              }
              className={cn(
                stats.failed === 0 && 'opacity-70',
                stats.failed > 0 && 'border-destructive/20 bg-destructive/5',
              )}
            />
          </>
        ) : null}
      </StatsPanel>

      {showOpenFolder && jobOutput ? (
        <div className="flex flex-col gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                <IconCircleCheck size={14} />
                {finishedLabel}
              </p>
              <p
                className="mt-1 truncate text-sm font-medium"
                title={jobOutput.outputDir}
              >
                {basenameOf(jobOutput.outputDir)}
              </p>
              <p
                className="truncate text-[11px] text-muted-foreground"
                title={jobOutput.outputDir}
              >
                {jobOutput.outputDir}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 bg-background"
              onClick={() => {
                setOpenFolderError(null);
                void revealInFinder(jobOutput.outputDir).catch(() => {
                  setOpenFolderError(
                    'Could not open the output folder in Finder.',
                  );
                });
              }}
            >
              <IconFolderOpen size={16} />
              Open in Finder
            </Button>
          </div>
          {openFolderError ? (
            <p className="text-xs text-destructive">{openFolderError}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default ConversionStatsPanel;
