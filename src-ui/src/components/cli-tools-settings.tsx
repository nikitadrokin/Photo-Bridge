import {
  IconAlertTriangle,
  IconCircleCheck,
  IconDownload,
  IconPackage,
} from '@tabler/icons-react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';

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
      return 'App bundle';
    case 'missing':
      return 'Not installed';
  }
}

function sourceBadgeVariant(
  source: CliToolSource,
): 'default' | 'secondary' | 'destructive' {
  switch (source) {
    case 'system':
      return 'default';
    case 'app':
      return 'secondary';
    case 'missing':
      return 'destructive';
  }
}

function SourceIcon({ source }: { source: CliToolSource }) {
  if (source === 'missing') {
    return <IconAlertTriangle className="text-destructive" />;
  }
  if (source === 'app') {
    return <IconPackage className="text-muted-foreground" />;
  }
  return <IconCircleCheck className="text-primary" />;
}

function CliToolRow({ tool }: { tool: CliToolStatus }) {
  const pathValue =
    tool.resolvedPath ??
    'Not found — install into the app to avoid global setup.';

  return (
    <Item variant="outline" size="sm">
      <ItemMedia variant="icon">
        <SourceIcon source={tool.source} />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {tool.name}
          <Badge variant={sourceBadgeVariant(tool.source)}>
            {sourceLabel(tool.source)}
          </Badge>
        </ItemTitle>
        <ItemDescription>{tool.description}</ItemDescription>
        <Field className="mt-2">
          <FieldLabel htmlFor={`cli-tool-path-${tool.id}`} className="text-xs">
            Resolved path
          </FieldLabel>
          <Input
            id={`cli-tool-path-${tool.id}`}
            readOnly
            value={pathValue}
            aria-readonly
            className="font-mono text-xs"
          />
          {tool.version ? (
            <FieldDescription>Version {tool.version}</FieldDescription>
          ) : null}
        </Field>
      </ItemContent>
      {tool.source === 'missing' ? (
        <ItemActions>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Install logic not implemented yet"
          >
            <IconDownload data-icon="inline-start" />
            Install into app
          </Button>
        </ItemActions>
      ) : null}
    </Item>
  );
}

export function CliToolsSettings() {
  const tools = MOCK_CLI_TOOL_STATUS;
  const missingTools = tools.filter((tool) => tool.source === 'missing');

  return (
    <FieldSet>
      <FieldLegend>CLI tools</FieldLegend>
      <FieldDescription>
        Photo Bridge shells out to a small set of command-line tools. This panel
        will show where each binary is resolved from once detection is wired up.
      </FieldDescription>

      <Alert>
        <IconPackage />
        <AlertTitle>Dev note: resolution order</AlertTitle>
        <AlertDescription>
          <p>
            If a tool is already on your PATH (for example{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              ffmpeg
            </code>{' '}
            from Homebrew), Photo Bridge will use that global install.
          </p>
          <p>
            When a required tool is missing, we plan to download it into the app
            bundle instead of asking users to install it system-wide. That keeps
            permissions simple and avoids relying on{' '}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">
              brew
            </code>{' '}
            or other global package managers.
          </p>
        </AlertDescription>
      </Alert>

      <FieldGroup>
        <ItemGroup>
          {tools.map((tool) => (
            <CliToolRow key={tool.id} tool={tool} />
          ))}
        </ItemGroup>
      </FieldGroup>

      {missingTools.length > 0 ? (
        <Alert variant="destructive">
          <IconAlertTriangle />
          <AlertTitle>
            {missingTools.length === 1
              ? '1 tool is not installed'
              : `${missingTools.length} tools are not installed`}
          </AlertTitle>
          <AlertDescription>
            <p>
              Missing:{' '}
              {missingTools.map((tool) => tool.name).join(', ')}. Install them
              into the app so features work without a global setup step.
            </p>
          </AlertDescription>
          <div className="col-start-2 mt-2">
            <Button
              type="button"
              size="sm"
              disabled
              title="Install logic not implemented yet"
            >
              <IconDownload data-icon="inline-start" />
              Install missing tools
            </Button>
          </div>
        </Alert>
      ) : null}
    </FieldSet>
  );
}
