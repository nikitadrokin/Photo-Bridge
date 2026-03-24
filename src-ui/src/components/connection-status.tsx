import {
  ArrowsClockwise,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import {
  Alert,
  AlertAction,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
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
    <Alert
      variant={isConnected ? 'default' : 'destructive'}
      className={cn(
        isConnected &&
          'border-green-500/25 [&>svg]:text-green-600 dark:[&>svg]:text-green-500',
      )}
    >
      {isConnected ? (
        <CheckCircle className="size-4" weight="duotone" />
      ) : (
        <WarningCircle className="size-4" weight="duotone" />
      )}
      <AlertTitle className="flex items-center gap-2">
        {isConnected ? 'Pixel Connected' : 'No Device Found'}
        {isConnected ? (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
        ) : null}
      </AlertTitle>
      <AlertDescription>
        {isConnected
          ? 'Device ready for transfers'
          : 'Connect via USB with debugging enabled'}
      </AlertDescription>
      <AlertAction>
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRunning}
          className="gap-2"
        >
          <ArrowsClockwise
            className={cn('size-3.5', isRunning && 'animate-spin')}
            weight="bold"
          />
          {isRunning ? 'Checking…' : 'Refresh'}
        </Button>
      </AlertAction>
    </Alert>
  );
}
