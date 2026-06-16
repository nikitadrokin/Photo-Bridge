import { Fragment, useMemo, useState } from 'react';
import type { PixelFilePayload } from '@cli-protocol';
import { IconChevronRight, IconFileFilled } from '@tabler/icons-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatGalleryDayTitle } from '@/lib/gallery-scan';
import { cn } from '@/lib/utils';

interface PixelFileTableProps {
  readonly files: readonly PixelFilePayload[];
}

interface DayBucket {
  readonly dayKey: string;
  readonly files: PixelFilePayload[];
}

function dayKeyFromUnix(unixSeconds: number | null): string {
  if (unixSeconds === null) return 'unknown';
  const date = new Date(unixSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function groupByDay(files: readonly PixelFilePayload[]): DayBucket[] {
  const byDay = new Map<string, PixelFilePayload[]>();
  for (const file of files) {
    const key = dayKeyFromUnix(file.mtimeUnix);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(file);
    else byDay.set(key, [file]);
  }
  return [...byDay.entries()]
    .map(([dayKey, dayFiles]) => ({ dayKey, files: dayFiles }))
    .sort((a, b) => {
      if (a.dayKey === 'unknown') return 1;
      if (b.dayKey === 'unknown') return -1;
      return b.dayKey.localeCompare(a.dayKey);
    });
}

const PixelFileTable: React.FC<PixelFileTableProps> = ({ files }) => {
  const days = useMemo(() => groupByDay(files), [files]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (dayKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) next.delete(dayKey);
      else next.add(dayKey);
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-28 text-right">Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {days.map((day) => {
            const isExpanded = !collapsed.has(day.dayKey);
            return (
              <Fragment key={day.dayKey}>
                <TableRow
                  aria-expanded={isExpanded}
                  className="cursor-pointer bg-muted/30"
                  onClick={() => {
                    toggle(day.dayKey);
                  }}
                >
                  <TableCell colSpan={2} className="py-2.5">
                    <div className="flex items-center gap-2">
                      <IconChevronRight
                        size={16}
                        className={cn(
                          'text-muted-foreground transition-transform',
                          isExpanded && 'rotate-90',
                        )}
                      />
                      <span className="font-semibold tracking-tight">
                        {formatGalleryDayTitle(day.dayKey)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {day.files.length} file
                        {day.files.length === 1 ? '' : 's'}
                      </span>
                    </div>
                  </TableCell>
                </TableRow>

                {isExpanded
                  ? day.files.map((file) => (
                      <TableRow key={file.path}>
                        <TableCell className="pl-8">
                          <div className="flex items-center gap-2">
                            <IconFileFilled
                              size={16}
                              className="text-muted-foreground"
                            />
                            <span className="font-medium">{file.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground tabular-nums">
                          {formatBytes(file.sizeBytes)}
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default PixelFileTable;
