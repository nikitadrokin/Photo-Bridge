import { type ReactNode, useContext, useLayoutEffect } from 'react';
import { PageHeaderActionsContext } from '@/components/contexts/page-header-actions-context';

/**
 * Registers nodes rendered beside the title in `PageHeader` for the active route.
 * Clears on unmount.
 */
export function useRegisterPageHeaderActions(actions: ReactNode): void {
  const ctx = useContext(PageHeaderActionsContext);
  const setHeaderActions = ctx?.setHeaderActions;

  useLayoutEffect(() => {
    if (!setHeaderActions) {
      if (import.meta.env.DEV) {
        console.warn(
          'useRegisterPageHeaderActions must be used within PageHeaderActionsProvider.',
        );
      }
      return;
    }

    setHeaderActions(actions);
    return () => {
      setHeaderActions(null);
    };
  }, [actions, setHeaderActions]);
}
