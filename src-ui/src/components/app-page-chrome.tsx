import {
  type ReactNode,
  type SetStateAction,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Outlet } from '@tanstack/react-router';
import { PageHeader } from '@/components/header';
import { useRoutePageMetadata } from '@/lib/route-page-metadata';

interface PageHeaderActionsContextValue {
  /** Current nodes shown beside the page title. */
  headerActions: ReactNode;
  /** Updates `headerActions`; used by `useRegisterPageHeaderActions`. */
  setHeaderActions: React.Dispatch<SetStateAction<ReactNode>>;
}

const PageHeaderActionsContext =
  createContext<PageHeaderActionsContextValue | null>(null);

interface PageHeaderActionsProviderProps {
  children: ReactNode;
}

/**
 * Supplies header action state for the app shell so routes and other chrome
 * (e.g. sidebar) can register `PageHeader` actions.
 */
export function PageHeaderActionsProvider({
  children,
}: PageHeaderActionsProviderProps) {
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  const value = useMemo(
    () => ({ headerActions, setHeaderActions }),
    [headerActions],
  );

  return (
    <PageHeaderActionsContext.Provider value={value}>
      {children}
    </PageHeaderActionsContext.Provider>
  );
}

/**
 * App shell: fixed page header (title from route `staticData`) and scrollable body.
 */
export function AppPageChrome() {
  const { title, description } = useRoutePageMetadata();
  const ctx = useContext(PageHeaderActionsContext);
  if (!ctx) {
    throw new Error('AppPageChrome must be used within PageHeaderActionsProvider.');
  }

  return (
    <>
      <PageHeader title={title} description={description}>
        {ctx.headerActions}
      </PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <Outlet />
      </div>
    </>
  );
}

/**
 * Registers nodes rendered beside the title in `PageHeader` for the active route.
 * Clears on unmount.
 */
export function useRegisterPageHeaderActions(actions: ReactNode): void {
  const ctx = useContext(PageHeaderActionsContext);
  if (!ctx) {
    throw new Error(
      'useRegisterPageHeaderActions must be used within PageHeaderActionsProvider.',
    );
  }

  const { setHeaderActions } = ctx;

  useEffect(() => {
    setHeaderActions(actions);
    return () => {
      setHeaderActions(null);
    };
  }, [actions, setHeaderActions]);
}
