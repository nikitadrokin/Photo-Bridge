import { ArrowsClockwise, HardDrives } from '@phosphor-icons/react';
import {
  Card,
  CardContent,
  CardFooter,
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
  const showValue = storage.status === 'ok' && storage.availLabel !== undefined;
  const showError = storage.status === 'error';

  return (
    <Card size="sm" className="border-border/80">
      <CardContent className="flex flex-row items-start justify-between space-y-0">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <HardDrives className="size-4" weight="duotone" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Available storage</p>
            {showValue ? (
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight">
                {storage.availLabel}
              </p>
            ) : null}
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
      </CardContent>

      <StatusMessage
        storage={storage}
        showValue={showValue}
        disabled={disabled}
        showError={showError}
      />
    </Card>
  );
}

const StatusMessage = ({
  storage,
  showValue,
  disabled,
  showError,
}: {
  storage: any;
  showValue: boolean;
  disabled: boolean;
  showError: boolean;
}) => (
  <CardContent>
    {storage.status === 'loading' && !showValue ? (
      <p className="text-xs text-muted-foreground">Checking…</p>
    ) : storage.status === 'idle' && !disabled ? (
      <p className="text-xs text-muted-foreground">
        Connect a device to load free space.
      </p>
    ) : disabled && storage.status === 'idle' ? (
      <p className="text-xs text-muted-foreground">Connect your Pixel.</p>
    ) : showError ? (
      <p className="text-xs text-destructive">{storage.errorMessage}</p>
    ) : null}
  </CardContent>
);
