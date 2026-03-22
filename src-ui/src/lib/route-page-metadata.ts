import { useMatches } from '@tanstack/react-router';

/** Declarative page title/description attached to a route via `staticData`. */
export interface RoutePageStaticData {
  /** Primary heading shown in the app chrome. */
  pageTitle?: string;
  /** Optional subtitle under the title. */
  pageDescription?: string;
}

const DEFAULT_TITLE = 'Photo Bridge';

/**
 * Resolves the active leaf route’s `staticData` page fields for the shell header.
 */
export function useRoutePageMetadata(): {
  title: string;
  description: string | undefined;
} {
  const matches = useMatches();

  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const data = matches[i].staticData as RoutePageStaticData | undefined;
    if (data?.pageTitle) {
      return {
        title: data.pageTitle,
        description: data.pageDescription,
      };
    }
  }

  return { title: DEFAULT_TITLE, description: undefined };
}
