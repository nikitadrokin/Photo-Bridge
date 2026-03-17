import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import usePixelInternal from '@/hooks/use-pixel';

type PixelContextValue = ReturnType<typeof usePixelInternal>;

const PixelContext = createContext<PixelContextValue | null>(null);

interface PixelProviderProps {
  children: ReactNode;
}

export const PixelProvider: React.FC<PixelProviderProps> = ({ children }) => {
  const pixel = usePixelInternal();
  return (
    <PixelContext.Provider value={pixel}>{children}</PixelContext.Provider>
  );
};

/** Shared hook for Pixel device operations - must be used within PixelProvider */
export function usePixel(): PixelContextValue {
  const context = useContext(PixelContext);
  if (!context) {
    throw new Error('usePixel must be used within a PixelProvider');
  }
  return context;
}
