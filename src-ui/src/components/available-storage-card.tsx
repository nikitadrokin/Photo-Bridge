import { ArrowsClockwise, HardDrives } from '@phosphor-icons/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { AvailableStorageState } from '@/lib/types';
import { cn } from '@/lib/utils';

interface AvailableStorageCardProps {
  readonly storage: AvailableStorageState;
  readonly disabled: boolean;
  readonly onRefresh: () => void;
}

export function AvailableStorageCard({
  storage,
  disabled,
  onRefresh,
}: AvailableStorageCardProps) {
  const showValue =
    storage.status === 'ok' && storage.availLabel !== undefined;
  const showError = storage.status === 'error';

  return (
    <Card size="sm" className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HardDrives className="size-4" weight="duotone" />
          </div>
          <div>
            <CardTitle className="text-sm">Available storage</CardTitle>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          disabled={disabled || storage.status === 'loading'}
          onClick={() => {
            onRefresh();
          }}
          aria-label="Refresh storage"
        >
          <ArrowsClockwise
            className={cn(
              'size-3.5',
              storage.status === 'loading' && 'animate-spin',
            )}
            weight="bold"
          />
        </Button>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {showValue ? (
          <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
            {storage.availLabel}
          </p>
        ) : null}
        {storage.status === 'loading' && !showValue ? (
          <p className="text-xs text-muted-foreground">Checking…</p>
        ) : null}
        {storage.status === 'idle' && !disabled ? (
          <p className="text-xs text-muted-foreground">
            Connect a device to load free space.
          </p>
        ) : null}
        {disabled && storage.status === 'idle' ? (
          <p className="text-xs text-muted-foreground">Connect your Pixel.</p>
        ) : null}
        {showError ? (
          <p className="text-xs text-destructive">{storage.errorMessage}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
