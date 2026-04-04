import { createFileRoute } from '@tanstack/react-router';
import {
  ArrowClockwise,
  Clock,
  File,
  Play,
  Spinner,
  X,
} from '@phosphor-icons/react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from '@/components/ui/field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import DropzoneOverlay from '@/components/dropzone-overlay';
import SelectFiles from '@/components/select-files';
import { useDragDrop } from '@/hooks/use-drag-drop';
import { usePixel } from '@/hooks/use-pixel';
import { ALL_EXTENSIONS } from '@/lib/constants';
import type { MediaDateInspectResult } from '@/lib/media-date-inspect';
import { useMediaStore } from '@/stores/media-store';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/fix-dates')({
  staticData: {
    pageTitle: 'Fix Dates (Google Photos only)',
    pageDescription:
      'Experimental: inspect metadata sources and override the automatic date.',
  },
  component: FixDatesPage,
});

function basenameOf(p: string): string {
  const parts = p.split('/');
  return parts[parts.length - 1] ?? p;
}

function FixDatesPage() {
  const { selectedPaths, setSelectedPaths, clearSelection } = useMediaStore();
  const pixel = usePixel();
  const [activePath, setActivePath] = useState<string | null>(null);
  const [inspectResult, setInspectResult] =
    useState<MediaDateInspectResult | null>(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>('');
  const [googleTakeoutApply, setGoogleTakeoutApply] = useState(false);
  const [inspectBusy, setInspectBusy] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);

  useEffect(() => {
    if (selectedPaths.length === 0) {
      setActivePath(null);
      setInspectResult(null);
      setSelectedCandidateId('');
      return;
    }
    setActivePath((prev) => {
      if (prev && selectedPaths.includes(prev)) {
        return prev;
      }
      return selectedPaths[0] ?? null;
    });
  }, [selectedPaths]);

  const { isDragging } = useDragDrop({
    extensions: ALL_EXTENSIONS,
    onDrop: (paths) => {
      setSelectedPaths(paths);
      pixel.clearLogs();
    },
  });

  const loadInspect = useCallback(async () => {
    if (!activePath) return;
    setInspectBusy(true);
    setInspectResult(null);
    try {
      const res = await pixel.inspectMediaDateCandidates(activePath);
      if (!res.ok) {
        toast.error(res.detail);
        return;
      }
      setInspectResult(res.data);
      const pick =
        res.data.suggestedCandidateId ??
        res.data.candidates.find((c) => c.unixSeconds !== null)?.id ??
        '';
      setSelectedCandidateId(pick);
    } finally {
      setInspectBusy(false);
    }
  }, [activePath, pixel]);

  const applySelected = useCallback(async () => {
    if (!activePath || !selectedCandidateId) return;
    const c = inspectResult?.candidates.find(
      (x) => x.id === selectedCandidateId,
    );
    if (!c || c.unixSeconds === null) {
      toast.error('Pick a source with a valid timestamp.');
      return;
    }
    setApplyBusy(true);
    try {
      const res = await pixel.applyMediaDateUnix(
        activePath,
        c.unixSeconds,
        googleTakeoutApply,
      );
      if (!res.ok) {
        toast.error(res.detail);
        return;
      }
      toast.success('Date written.');
      await loadInspect();
    } finally {
      setApplyBusy(false);
    }
  }, [
    activePath,
    selectedCandidateId,
    inspectResult,
    googleTakeoutApply,
    pixel,
    loadInspect,
  ]);

  const autoBusy = pixel.isRunning && pixel.activeOperation === 'fix-dates';

  const candidateOptions = useMemo(() => {
    if (!inspectResult) return [];
    return inspectResult.candidates.map((c) => ({
      value: c.id,
      title: c.label,
      description: c.raw,
      disabled: c.unixSeconds === null,
      isSuggested: inspectResult.suggestedCandidateId === c.id,
    }));
  }, [inspectResult]);

  const hasSelection = selectedPaths.length > 0;

  return (
    <>
      <DropzoneOverlay isVisible={isDragging} extensions={ALL_EXTENSIONS} />

      <main className="flex-1 p-2">
        <div className="mx-auto max-w-3xl flex flex-col gap-6">
          <p className="text-sm text-muted-foreground border-l-2 border-amber-500/80 pl-3 py-1">
            Experimental: automatic fixing stays on Convert Media. Here you can
            inspect every embedded or Takeout date and apply one explicitly.
          </p>

          {!hasSelection ? (
            <SelectFiles />
          ) : (
            <>
              <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <File size={16} weight="duotone" className="text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {selectedPaths.length} item
                      {selectedPaths.length !== 1 ? 's' : ''} selected
                    </p>
                    {selectedPaths.length > 1 ? (
                      <label className="sr-only" htmlFor="fix-dates-active">
                        Active file
                      </label>
                    ) : null}
                    {selectedPaths.length > 1 ? (
                      <select
                        id="fix-dates-active"
                        className="mt-1 w-full max-w-md text-xs bg-background border rounded-md px-2 py-1.5"
                        value={activePath ?? ''}
                        onChange={(e) => {
                          setActivePath(e.target.value);
                          setInspectResult(null);
                          setSelectedCandidateId('');
                        }}
                      >
                        {selectedPaths.map((p) => (
                          <option key={p} value={p}>
                            {basenameOf(p)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">
                        {basenameOf(selectedPaths[0] ?? '')}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-muted-foreground hover:text-destructive shrink-0 h-8 w-8 p-0"
                  aria-label="Clear selection"
                >
                  <X size={16} weight="bold" />
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="default"
                  className="gap-2"
                  disabled={!activePath || pixel.isRunning || inspectBusy}
                  onClick={() => void loadInspect()}
                >
                  {inspectBusy ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <ArrowClockwise size={18} weight="duotone" />
                  )}
                  Load date sources
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={pixel.isRunning || autoBusy}
                  onClick={() => pixel.fixDates(selectedPaths)}
                >
                  {autoBusy ? (
                    <Spinner size={18} className="animate-spin" />
                  ) : (
                    <Clock size={18} weight="duotone" />
                  )}
                  Run automatic fix-dates
                </Button>
              </div>

              {inspectResult ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">
                      {inspectResult.basename}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {inspectResult.mediaKind} ·{' '}
                      {inspectResult.hasAutomaticDateOk
                        ? 'Automatic check: embedded date looks OK'
                        : 'Automatic check: may need a fix'}
                    </p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4">
                    <FieldSet className="gap-2">
                      <FieldLegend variant="label">
                        Pick a source to write
                      </FieldLegend>
                      <RadioGroup
                        value={selectedCandidateId}
                        onValueChange={(v) => {
                          if (typeof v === 'string') {
                            setSelectedCandidateId(v);
                          }
                        }}
                        className="gap-2"
                        disabled={applyBusy}
                      >
                        {candidateOptions.map((opt) => (
                          <FieldLabel
                            key={opt.value}
                            htmlFor={`cand-${opt.value}`}
                            className={cn(
                              'w-full',
                              opt.disabled && 'opacity-50 cursor-not-allowed',
                            )}
                          >
                            <Field orientation="horizontal">
                              <FieldContent>
                                <FieldTitle className="text-sm flex items-center gap-2">
                                  {opt.title}
                                  {opt.isSuggested ? (
                                    <span className="text-[10px] font-normal uppercase tracking-wide text-primary">
                                      suggested
                                    </span>
                                  ) : null}
                                </FieldTitle>
                                <FieldDescription className="font-mono text-xs break-all">
                                  {opt.description}
                                  {opt.disabled
                                    ? ' · no parseable timestamp'
                                    : ''}
                                </FieldDescription>
                              </FieldContent>
                              <RadioGroupItem
                                value={opt.value}
                                id={`cand-${opt.value}`}
                                disabled={opt.disabled}
                              />
                            </Field>
                          </FieldLabel>
                        ))}
                      </RadioGroup>
                    </FieldSet>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="fix-dates-takeout-apply"
                        checked={googleTakeoutApply}
                        onChange={(e) =>
                          setGoogleTakeoutApply(e.target.checked)
                        }
                        className="rounded border-input"
                      />
                      <Label
                        htmlFor="fix-dates-takeout-apply"
                        className="text-sm font-normal cursor-pointer"
                      >
                        Also write GPS from Takeout JSON (if present)
                      </Label>
                    </div>

                    <Button
                      type="button"
                      className="gap-2 w-fit"
                      disabled={
                        applyBusy ||
                        !selectedCandidateId ||
                        candidateOptions.find(
                          (o) => o.value === selectedCandidateId,
                        )?.disabled
                      }
                      onClick={() => void applySelected()}
                    >
                      {applyBusy ? (
                        <Spinner size={18} className="animate-spin" />
                      ) : (
                        <Play size={18} weight="fill" />
                      )}
                      Apply selected date
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}
