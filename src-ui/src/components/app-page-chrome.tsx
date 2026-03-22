import {
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';
import { PageHeader } from '@/components/header';
import { useRoutePageMetadata } from '@/lib/route-page-metadata';

const SetPageHeaderActionsContext = createContext<React.Dispatch<
  SetStateAction<ReactNode>
> | null>(null);

interface AppPageChromeProps {
  /** Main route outlet; scrolls independently of the header. */
  children: ReactNode;
}

/**
 * App shell: fixed page header (title from route `staticData`) and scrollable body.
 */
export function AppPageChrome({ children }: AppPageChromeProps) {
  const { title, description } = useRoutePageMetadata();
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <SetPageHeaderActionsContext.Provider value={setHeaderActions}>
      <PageHeader title={title} description={description}>
        {headerActions}
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        {children}
      </div>
    </SetPageHeaderActionsContext.Provider>
  );
}

/**
 * Registers nodes rendered beside the title in `PageHeader` for the active route.
 * Clears on unmount.
 */
export function useRegisterPageHeaderActions(actions: ReactNode): void {
  const setActions = useContext(SetPageHeaderActionsContext);
  if (!setActions) {
    throw new Error(
      'useRegisterPageHeaderActions must be used within AppPageChrome.',
    );
  }

  useEffect(() => {
    setActions(actions);
    return () => {
      setActions(null);
    };
  }, [actions, setActions]);
}
