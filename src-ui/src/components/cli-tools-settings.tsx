import { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconLoader2,
  IconPackage,
  IconRefresh,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';

/** Where a CLI tool binary was resolved from. */
type CliToolSource = 'system' | 'app' | 'missing';

/** Resolved status for one CLI tool, returned by the `resolve_cli_tools` command. */
interface CliToolStatus {
  id: string;
  name: string;
  description: string;
  source: CliToolSource;
  /** Resolved path when installed; `null` when missing. */
  resolvedPath: string | null;
  /** Reported version string when available. */
  version: string | null;
  /** Whether a 1-click install is available for this tool. */
  installable: boolean;
}

/** Progress event streamed from the backend during an install. */
interface InstallProgress {
  id: string;
  phase: 'downloading' | 'verifying' | 'extracting' | 'finalizing' | 'done';
  message: string;
}

function sourceLabel(source: CliToolSource): string {
  switch (source) {
    case 'system':
      return 'System';
    case 'app':
      return 'App';
    case 'missing':
      return 'Missing';
  }
}

function sourceBadgeVariant(
  source: CliToolSource,
): 'secondary' | 'outline' | 'destructive' {
  switch (source) {
    case 'system':
      return 'secondary';
    case 'app':
      return 'outline';
    case 'missing':
      return 'destructive';
  }
}

function SourceIcon({ source }: { source: CliToolSource }) {
  const className = 'size-4 shrink-0';
  if (source === 'missing') {
    return <IconAlertTriangle className={`${className} text-destructive`} />;
  }
  if (source === 'app') {
    return <IconPackage className={`${className} text-muted-foreground`} />;
  }
  return <IconCircleCheck className={`${className} text-primary`} />;
}

interface CliToolRowProps {
  tool: CliToolStatus;
  /** In-flight install message, or `null` when idle. */
  progress: string | null;
  onInstall: (id: string) => void;
}

/** One dense, single-line status row per tool. */
function CliToolRow({ tool, progress, onInstall }: CliToolRowProps) {
  const isMissing = tool.source === 'missing';
  const isInstalling = progress !== null;

  return (
    <div className="flex items-center gap-3 px-3 py-2 text-sm">
      <SourceIcon source={tool.source} />

      <span className="w-20 shrink-0 font-medium">{tool.name}</span>

      <span className="w-12 shrink-0 text-xs tabular-nums text-muted-foreground">
        {tool.version ?? '—'}
      </span>

      <span
        className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
        title={tool.resolvedPath ?? tool.description}
      >
        {isInstalling
          ? progress
          : (tool.resolvedPath ?? 'Not found on PATH')}
      </span>

      {isMissing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          disabled={isInstalling || !tool.installable}
          onClick={() => onInstall(tool.id)}
        >
          {isInstalling ? (
            <IconLoader2 className="size-3.5 animate-spin" data-icon="inline-start" />
          ) : (
            <IconDownload className="size-3.5" data-icon="inline-start" />
          )}
          {isInstalling ? 'Installing' : 'Install'}
        </Button>
      ) : (
        <Badge
          variant={sourceBadgeVariant(tool.source)}
          className="shrink-0 text-xs"
        >
          {sourceLabel(tool.source)}
        </Badge>
      )}
    </div>
  );
}

export function CliToolsSettings() {
  const [tools, setTools] = useState<CliToolStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Map of tool id → current install progress message. */
  const [progress, setProgress] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const result = await invoke<CliToolStatus[]>('resolve_cli_tools');
      setTools(result);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Stream install progress from the backend into per-tool messages.
  useEffect(() => {
    const unlisten = listen<InstallProgress>(
      'cli-tool-install-progress',
      (event) => {
        const { id, phase, message } = event.payload;
        setProgress((prev) => {
          if (phase === 'done') {
            const { [id]: _done, ...rest } = prev;
            return rest;
          }
          return { ...prev, [id]: message };
        });
      },
    );
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, []);

  const handleInstall = useCallback(
    async (id: string) => {
      setError(null);
      setProgress((prev) => ({ ...prev, [id]: 'Starting…' }));
      try {
        await invoke<string>('install_cli_tool', { id });
        await refresh();
      } catch (err) {
        setError(`Install failed: ${String(err)}`);
      } finally {
        setProgress((prev) => {
          const { [id]: _gone, ...rest } = prev;
          return rest;
        });
      }
    },
    [refresh],
  );

  const handleInstallMissing = useCallback(async () => {
    const missing = tools.filter((t) => t.source === 'missing' && t.installable);
    for (const tool of missing) {
      await handleInstall(tool.id);
    }
  }, [tools, handleInstall]);

  const missingTools = tools.filter((tool) => tool.source === 'missing');
  const readyCount = tools.length - missingTools.length;
  const anyInstalling = Object.keys(progress).length > 0;

  return (
    <FieldSet>
      <div className="flex items-baseline justify-between gap-4">
        <FieldLegend>CLI tools</FieldLegend>
        <div className="flex items-center gap-2">
          {!loading ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {readyCount} of {tools.length} ready
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-6"
            onClick={() => void refresh()}
            disabled={anyInstalling}
            title="Re-scan"
            aria-label="Re-scan tools"
          >
            <IconRefresh className="size-3.5" />
          </Button>
        </div>
      </div>
      <FieldDescription>
        Command-line tools Photo Bridge shells out to. Tools already on your PATH
        are used directly; missing ones can be installed into the app bundle.
      </FieldDescription>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border px-3 py-6 text-sm text-muted-foreground">
          <IconLoader2 className="size-4 animate-spin" />
          Detecting tools…
        </div>
      ) : (
        <div className="divide-y rounded-md border">
          {tools.map((tool) => (
            <CliToolRow
              key={tool.id}
              tool={tool}
              progress={progress[tool.id] ?? null}
              onInstall={(id) => void handleInstall(id)}
            />
          ))}
        </div>
      )}

      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!loading && missingTools.length > 0 ? (
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>
            <span className="text-destructive">
              {missingTools.length === 1
                ? '1 tool missing'
                : `${missingTools.length} tools missing`}
            </span>{' '}
            · {missingTools.map((tool) => tool.name).join(', ')}
          </span>
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs"
            onClick={() => void handleInstallMissing()}
            disabled={anyInstalling}
          >
            {anyInstalling ? (
              <IconLoader2 className="size-3.5 animate-spin" data-icon="inline-start" />
            ) : (
              <IconDownload className="size-3.5" data-icon="inline-start" />
            )}
            Install missing
          </Button>
        </div>
      ) : null}
    </FieldSet>
  );
}
