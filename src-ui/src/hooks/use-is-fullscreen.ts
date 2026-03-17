import { Window } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';

/**
 * Hook to detect and track the fullscreen state of the Tauri window.
 * Listens to window resize events to detect fullscreen toggles.
 */
const useIsFullscreen = (): boolean | undefined => {
  const [isFullscreen, setIsFullscreen] = useState<boolean | undefined>(
    undefined,
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      const appWindow = Window.getCurrent();

      // Initial check
      const fullscreenState = await appWindow.isFullscreen();
      setIsFullscreen(fullscreenState);

      // Listen for resize events (Tauri emits this on fullscreen toggle)
      unlisten = await appWindow.onResized(async () => {
        const isFS = await appWindow.isFullscreen();
        setIsFullscreen(isFS);
      });
    };

    setupListener();

    // Cleanup the listener on unmount
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  return isFullscreen;
};

export default useIsFullscreen;
