import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { DeviceInfoState } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  IconRefresh,
  IconBox,
  IconBattery2,
  IconDeviceMobile,
  IconDatabase,
} from '@tabler/icons-react';

interface DeviceInfoCardProps {
  readonly info: DeviceInfoState;
  readonly disabled: boolean;
  readonly onRefresh: () => void;
}

interface StatTileProps {
  icon: React.ReactNode;
  label: string;
  value: string | undefined;
  loading: boolean;
}

function StatTile({ icon, label, value, loading }: StatTileProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('truncate text-sm font-semibold tabular-nums', !value && 'text-muted-foreground/50')}>
        {loading ? '–' : (value ?? '–')}
      </p>
    </div>
  );
}

export function DeviceInfoCard({ info, disabled, onRefresh }: DeviceInfoCardProps) {
  const loading = info.status === 'loading';
  const ok = info.status === 'ok';

  const batteryLabel = ok && info.batteryPct !== undefined
    ? `${info.batteryPct}%`
    : undefined;

  return (
    <Card size="sm" className="border-border/80">
      <CardContent className="flex flex-row items-center gap-3">
        <div className="flex min-w-0 flex-1 flex-row gap-4">
          <StatTile
            icon={<IconDeviceMobile className="size-3" />}
            label="Model"
            value={ok ? info.model : undefined}
            loading={loading}
          />
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
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 rounded-sm"
          disabled={disabled || loading}
          onClick={onRefresh}
          aria-label="Refresh device info"
        >
          <IconRefresh className={cn('size-3.5', loading && 'animate-spin')} />
        </Button>
      </CardContent>
    </Card>
  );
}
