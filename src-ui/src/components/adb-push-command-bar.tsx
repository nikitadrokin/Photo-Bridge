import { useCallback, useEffect, useRef, useState } from 'react';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { Button } from '@/components/ui/button';

interface AdbPushCommandBarProps {
  /** Full `adb push …` line to copy into Terminal. */
  readonly command: string;
}

/**
 * One-line native adb command, shown after an in-app push fails.
 * Not an action card — a terminal snippet with copy at the end.
 */
export function AdbPushCommandBar({ command }: AdbPushCommandBarProps) {
  const [copied, setCopied] = useState(false);
  const copiedResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedResetRef.current !== null) {
        clearTimeout(copiedResetRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      if (copiedResetRef.current !== null) {
        clearTimeout(copiedResetRef.current);
      }
      copiedResetRef.current = setTimeout(() => {
        setCopied(false);
        copiedResetRef.current = null;
      }, 1500);
    } catch {
      setCopied(false);
    }
  }, [command]);

  return (
    <div className="flex h-8 w-full items-center gap-2 rounded-md border border-dashed bg-background px-1 pl-2.5">
      <code
        className="min-w-0 flex-1 truncate font-mono text-[11px] leading-none text-muted-foreground"
        title={command}
      >
        {command}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="shrink-0"
        aria-label={copied ? 'Copied' : 'Copy'}
        onClick={() => {
          void handleCopy();
        }}
      >
        {copied ? (
          <IconCheck className="size-3.5" />
        ) : (
          <IconCopy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
