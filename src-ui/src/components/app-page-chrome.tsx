import {
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Outlet } from '@tanstack/react-router';
import { PageHeader } from '@/components/header';
import { PageHeaderActionsContext } from '@/components/page-header-actions-context';
import { useRoutePageMetadata } from '@/lib/route-page-metadata';

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

/** Full-width shell header: route title and registered actions. */
export function RootPageHeader() {
  const { title } = useRoutePageMetadata();
  const ctx = useContext(PageHeaderActionsContext);
  if (!ctx) {
    throw new Error(
      'RootPageHeader must be used within PageHeaderActionsProvider.',
    );
  }

  return <PageHeader title={title}>{ctx.headerActions}</PageHeader>;
}

/**
 * App shell: fixed page header (title from route `staticData`) and scrollable body.
 */
export function AppPageChrome() {
  const { title } = useRoutePageMetadata();
  const ctx = useContext(PageHeaderActionsContext);
  if (!ctx) {
    throw new Error(
      'AppPageChrome must be used within PageHeaderActionsProvider.',
    );
  }

  return (
    <>
      <PageHeader title={title}>{ctx.headerActions}</PageHeader>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
        <Outlet />
      </div>
    </>
  );
}

export { useRegisterPageHeaderActions } from '@/hooks/use-register-page-header-actions';
