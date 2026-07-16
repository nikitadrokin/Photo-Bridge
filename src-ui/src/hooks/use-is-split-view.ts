import { useEffect, useState } from 'react';

/** Keep in sync with the `@min-[64rem]/split` container variants. */
const SPLIT_VIEW_MIN_WIDTH = 64 * 16;

/**
 * Mirrors the split layout's CSS container query for behavior that cannot be
 * expressed in CSS, such as deciding whether a preview opens in a dialog.
 */
export function useIsSplitView() {
  const [container, containerRef] = useState<HTMLElement | null>(null);
  const [isSplitView, setIsSplitView] = useState(false);

  useEffect(() => {
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const [entry] = entries;
      setIsSplitView(entry.contentRect.width >= SPLIT_VIEW_MIN_WIDTH);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, [container]);

  return { containerRef, isSplitView };
}
