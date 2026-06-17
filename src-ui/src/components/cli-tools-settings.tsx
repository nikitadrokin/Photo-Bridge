import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconPackage,
} from '@tabler/icons-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldDescription, FieldLegend, FieldSet } from '@/components/ui/field';

/** Where a CLI tool binary was resolved from. */
type CliToolSource = 'system' | 'app' | 'missing';

/** Static tool definition used by the settings UI. */
interface CliToolDefinition {
  /** CLI binary name (e.g. `ffmpeg`). */
  id: string;
  /** Human-readable label. */
  name: string;
  /** Short description of what the tool is used for in Photo Bridge. */
  description: string;
}

/** Resolved status for one CLI tool (mock data until wired up). */
interface CliToolStatus extends CliToolDefinition {
  source: CliToolSource;
  /** Resolved path when installed; `null` when missing. */
  resolvedPath: string | null;
  /** Reported version string when available. */
  version: string | null;
}

/** Tools Photo Bridge shells out to. */
const CLI_TOOLS: readonly CliToolDefinition[] = [
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    description: 'Convert and transcode video files.',
  },
  {
    id: 'ffprobe',
    name: 'FFprobe',
    description: 'Read video metadata during conversion.',
  },
  {
    id: 'exiftool',
    name: 'ExifTool',
    description: 'Read and write photo and video metadata.',
  },
  {
    id: 'adb',
    name: 'ADB',
    description: 'Transfer files to and from a connected Pixel.',
  },
] as const;

/** Placeholder resolution state for the dev-only settings UI. */
const MOCK_CLI_TOOL_STATUS: readonly CliToolStatus[] = [
  {
    ...CLI_TOOLS[0],
    source: 'system',
    resolvedPath: '/opt/homebrew/bin/ffmpeg',
    version: '7.1',
  },
  {
    ...CLI_TOOLS[1],
    source: 'system',
    resolvedPath: '/opt/homebrew/bin/ffprobe',
    version: '7.1',
  },
  {
    ...CLI_TOOLS[2],
    source: 'missing',
    resolvedPath: null,
    version: null,
  },
  {
    ...CLI_TOOLS[3],
    source: 'app',
    resolvedPath: '~/Library/Application Support/Photo Bridge/bin/adb',
    version: '35.0.2',
  },
];

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

/** One dense, single-line status row per tool. */
function CliToolRow({ tool }: { tool: CliToolStatus }) {
  const isMissing = tool.source === 'missing';

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
        {tool.resolvedPath ?? 'Not found on PATH'}
      </span>

      {isMissing ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          disabled
          title="Install logic not implemented yet"
        >
          <IconDownload className="size-3.5" data-icon="inline-start" />
          Install
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
  const tools = MOCK_CLI_TOOL_STATUS;
  const missingTools = tools.filter((tool) => tool.source === 'missing');
  const readyCount = tools.length - missingTools.length;

  return (
    <FieldSet>
      <div className="flex items-baseline justify-between gap-4">
        <FieldLegend>CLI tools</FieldLegend>
        <span className="text-xs tabular-nums text-muted-foreground">
          {readyCount} of {tools.length} ready
        </span>
      </div>
      <FieldDescription>
        Command-line tools Photo Bridge shells out to. Tools already on your PATH
        are used directly; missing ones can be installed into the app bundle.
      </FieldDescription>

      <div className="divide-y rounded-md border">
        {tools.map((tool) => (
          <CliToolRow key={tool.id} tool={tool} />
        ))}
      </div>

      {missingTools.length > 0 ? (
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
            disabled
            title="Install logic not implemented yet"
          >
            <IconDownload className="size-3.5" data-icon="inline-start" />
            Install missing
          </Button>
        </div>
      ) : null}
    </FieldSet>
  );
}
