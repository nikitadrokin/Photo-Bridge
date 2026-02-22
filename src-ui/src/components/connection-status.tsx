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
    <div className="relative overflow-hidden rounded-xl border border-border/50 bg-background/50 p-4 backdrop-blur-md">
      {/* Background decoration */}
      <div
        className={cn(
          'absolute -right-20 -top-20 h-64 w-64 rounded-full bg-linear-to-br opacity-5 blur-3xl',
          isConnected
            ? 'from-green-500 to-emerald-500'
            : 'from-red-500 to-orange-500',
        )}
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors duration-500',
              isConnected
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500',
            )}
          >
            {isConnected ? (
              <CheckCircle size={20} weight="duotone" />
            ) : (
              <WarningCircle size={20} weight="duotone" />
            )}
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                {isConnected ? 'Pixel Connected' : 'No Device Found'}
              </h2>
              {isConnected && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                </span>
              )}
            </div>
            <p className="max-w-[400px] text-xs text-muted-foreground">
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
          className="shrink-0 gap-2 border-primary/20 hover:border-primary/50 hover:bg-primary/10"
        >
          <ArrowsClockwise
            size={14}
            weight="bold"
            className={cn(isRunning && 'animate-spin')}
          />
          {isRunning ? 'Checking' : 'Refresh'}
        </Button>
      </div>
    </div>
  );
}
