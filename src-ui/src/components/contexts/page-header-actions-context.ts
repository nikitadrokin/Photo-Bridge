import { type ReactNode, type SetStateAction, createContext } from 'react';

/** Context value for header action registration in the app shell. */
export interface PageHeaderActionsContextValue {
  /** Current nodes shown beside the page title. */
  headerActions: ReactNode;
  /** Updates `headerActions`; used by `useRegisterPageHeaderActions`. */
  setHeaderActions: React.Dispatch<SetStateAction<ReactNode>>;
}

/**
 * Shared context module — keep in its own file so code-split route chunks and HMR
 * do not create a second context instance during navigation.
 */
export const PageHeaderActionsContext =
  createContext<PageHeaderActionsContextValue | null>(null);
