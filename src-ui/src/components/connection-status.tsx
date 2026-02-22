import {
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  isConnected: boolean;
  isRunning: boolean;
  onRefresh: () => void;
}

export function ConnectionStatus({
  isConnected,
  isRunning,
  onRefresh,
}: ConnectionStatusProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-5">
      {/* Subtle gradient accent */}
      <div
        className={cn(
          'absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-[0.07] blur-3xl transition-colors duration-500',
          isConnected ? 'bg-green-500' : 'bg-red-500',
        )}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-500',
              isConnected
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500',
            )}
          >
            {isConnected ? (
              <CheckCircle size={22} weight="duotone" />
            ) : (
              <WarningCircle size={22} weight="duotone" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-semibold tracking-tight">
                {isConnected ? 'Pixel Connected' : 'No Device Found'}
              </h2>
              {isConnected ? (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {isConnected
                ? 'Device ready for transfers'
                : 'Connect via USB with debugging enabled'}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRunning}
          className="shrink-0 gap-2"
        >
          <ArrowsClockwise
            size={14}
            weight="bold"
            className={cn(isRunning && 'animate-spin')}
          />
          {isRunning ? 'Checking…' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
