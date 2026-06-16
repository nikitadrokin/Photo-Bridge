import { Fragment, useState } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import type {
  GalleryScanDayPayload,
  GalleryScanFilePayload,
} from '@cli-protocol';
import {
  IconChevronRight,
  IconMovie,
  IconPhoto,
} from '@tabler/icons-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  formatGalleryCaptureTime,
  formatGalleryDayTitle,
  isImagePath,
} from '@/lib/gallery-scan';
import { cn } from '@/lib/utils';

interface DayTreeTableProps {
  readonly days: readonly GalleryScanDayPayload[];
  readonly onSelectFile: (file: GalleryScanFilePayload) => void;
}

function FileThumb({ file }: { readonly file: GalleryScanFilePayload }) {
  if (isImagePath(file.path)) {
    return (
      <img
        src={convertFileSrc(file.path)}
        alt=""
        loading="lazy"
        className="size-9 rounded object-cover"
      />
    );
  }
  return (
    <div className="flex size-9 items-center justify-center rounded bg-muted text-muted-foreground">
      {file.mediaKind === 'video' ? (
        <IconMovie size={18} />
      ) : (
        <IconPhoto size={18} />
      )}
    </div>
  );
}

const DayTreeTable: React.FC<DayTreeTableProps> = ({ days, onSelectFile }) => {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const toggle = (dayKey: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dayKey)) {
        next.delete(dayKey);
      } else {
        next.add(dayKey);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12" />
            <TableHead>Name</TableHead>
            <TableHead className="w-24">Type</TableHead>
            <TableHead className="w-28 text-right">Time</TableHead>
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
                  <TableCell colSpan={4} className="py-2.5">
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
                  ? day.files.map((file) => {
                      const timeLabel = formatGalleryCaptureTime(
                        file.unixSeconds,
                      );
                      return (
                        <TableRow
                          key={file.path}
                          className="cursor-pointer"
                          onClick={() => {
                            onSelectFile(file);
                          }}
                        >
                          <TableCell className="py-1.5 pl-8">
                            <FileThumb file={file} />
                          </TableCell>
                          <TableCell className="font-medium">
                            {file.basename}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {file.mediaKind}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground tabular-nums">
                            {timeLabel || '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default DayTreeTable;
