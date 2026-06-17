import * as React from 'react';

/** Tailwind's `lg` breakpoint — where the app shell switches to two columns. */
const LARGE_BREAKPOINT = 1024;

/** True when the viewport is at least Tailwind's `lg` width. */
export function useIsLargeScreen() {
  const [isLarge, setIsLarge] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LARGE_BREAKPOINT}px)`);
    const onChange = () => {
      setIsLarge(window.innerWidth >= LARGE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsLarge(window.innerWidth >= LARGE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return !!isLarge;
}
