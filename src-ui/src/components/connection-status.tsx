import {
  IconRefresh,
  IconCircleCheck,
  IconAlertCircle,
} from '@tabler/icons-react';
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
  /** User-triggered ADB check in flight (not background / transfer busy). */
  isConnectionCheckPending: boolean;
  /** Transfer or other sidecar work — disables refresh without showing "Checking…". */
  disableRefresh: boolean;
  onRefresh: () => void;
}

export function ConnectionStatus({
  isConnected,
  isConnectionCheckPending,
  disableRefresh,
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
        <IconCircleCheck className="size-4" />
      ) : (
        <IconAlertCircle className="size-4" />
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
          variant="secondary"
          size="sm"
          onClick={onRefresh}
          disabled={disableRefresh || isConnectionCheckPending}
          className="gap-2"
        >
          <IconRefresh
            className={cn(
              'size-3.5',
              isConnectionCheckPending && 'animate-spin',
            )}
          />
          {isConnectionCheckPending ? 'Checking…' : 'Refresh'}
        </Button>
      </AlertAction>
    </Alert>
  );
}
