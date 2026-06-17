import { Button } from '@/components/ui/button';
import type { AvailableStorageState } from '@/lib/types';
import { cn } from '@/lib/utils';
import { IconRefresh, IconBox } from '@tabler/icons-react';

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
    <div className="flex flex-col gap-1">
      <div className="flex flex-row items-center justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
            <IconBox className="size-4" />
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
          className="size-8 shrink-0 rounded-sm"
          disabled={disabled || storage.status === 'loading'}
          onClick={() => {
            onRefresh();
          }}
          aria-label="Refresh storage"
        >
          <IconRefresh
            className={cn(
              'size-3.5',
              storage.status === 'loading' && 'animate-spin',
            )}
          />
        </Button>
      </div>

      <StatusMessage
        storage={storage}
        showValue={showValue}
        disabled={disabled}
        showError={showError}
      />
    </div>
  );
}

const StatusMessage = ({
  storage,
  showValue,
  disabled,
  showError,
}: {
  readonly storage: AvailableStorageState;
  readonly showValue: boolean;
  readonly disabled: boolean;
  readonly showError: boolean;
}) => {
  const body =
    storage.status === 'loading' && !showValue ? (
      <p className="text-xs text-muted-foreground">Checking…</p>
    ) : storage.status === 'idle' && !disabled ? (
      <p className="text-xs text-muted-foreground">
        Connect a device to load free space.
      </p>
    ) : disabled && storage.status === 'idle' ? (
      <p className="text-xs text-muted-foreground">Connect your Pixel.</p>
    ) : showError ? (
      <p className="text-xs text-destructive">{storage.errorMessage}</p>
    ) : null;

  if (body === null) {
    return null;
  }

  return <div className="pl-12">{body}</div>;
};
