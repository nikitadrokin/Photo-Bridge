import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DeviceInfoState } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  IconRefresh,
  IconBox,
  IconBattery2,
  IconDatabase,
  IconLoader2,
} from '@tabler/icons-react';

interface DeviceInfoCardProps {
  readonly info: DeviceInfoState;
  readonly disabled: boolean;
  readonly onRefresh: () => void;
  readonly refreshing?: boolean;
  readonly className?: string;
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  loading: boolean;
}

function StatTile({ icon, label, value, loading }: StatTileProps) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-lg border bg-card px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p
        className={cn(
          'text-lg font-bold tabular-nums leading-none',
          !value && 'text-muted-foreground/40',
        )}
      >
        {loading ? '–' : (value ?? '–')}
      </p>
    </div>
  );
}

export function DeviceInfoCard({
  info,
  disabled,
  onRefresh,
  refreshing,
  className,
}: DeviceInfoCardProps) {
  const loading = info.status === 'loading';
  const ok = info.status === 'ok';
  const busy = loading || refreshing;

  const batteryLabel =
    ok && info.batteryPct !== undefined ? `${info.batteryPct}%` : undefined;

  return (
    <Card size="sm" className={cn('dark:border', className)}>
      <CardContent className="flex flex-col gap-3 not-dark:px-0!">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">Device</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-xs"
            disabled={disabled || !!busy}
            onClick={onRefresh}
          >
            {busy ? (
              <IconLoader2 className="size-3 animate-spin" />
            ) : (
              <IconRefresh className="size-3" />
            )}
            Refresh
          </Button>
        </div>

        <div className="flex gap-2">
          <StatTile
            icon={<IconBattery2 className="size-3" />}
            label="Battery"
            value={batteryLabel}
            loading={loading}
          />
          <StatTile
            icon={<IconBox className="size-3" />}
            label="Free"
            value={ok ? info.storageAvail : undefined}
            loading={loading}
          />
          <StatTile
            icon={<IconDatabase className="size-3" />}
            label="Total"
            value={ok ? info.storageTotal : undefined}
            loading={loading}
          />
        </div>
      </CardContent>
    </Card>
  );
}
