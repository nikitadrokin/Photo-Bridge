import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { toast } from 'sonner';

interface UseDragDropOptions {
  /** Valid file extensions (without dot) */
  extensions: Array<string>;
  /** Callback when valid paths are dropped */
  onDrop: (paths: Array<string>) => void;
}

/**
 * Hook for handling global drag-and-drop events in a Tauri webview.
 * Validates file extensions and shows toast for invalid drops.
 */
export function useDragDrop({ extensions, onDrop }: UseDragDropOptions) {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const webview = getCurrentWebviewWindow();

    const unlisten = webview.onDragDropEvent((event) => {
      const { type } = event.payload;

      if (type === 'over') {
        setIsDragging(true);
      } else if (type === 'drop') {
        setIsDragging(false);
        const paths = event.payload.paths;

        // Filter paths to only include valid extensions (or directories)
        const validPaths = paths.filter((p) => {
          const ext = p.split('.').pop()?.toLowerCase() ?? '';
          // Accept if it's a valid extension or has no extension (likely a directory)
          return extensions.includes(ext) || !p.includes('.');
        });

        if (validPaths.length > 0) {
          onDrop(validPaths);
        } else if (paths.length > 0) {
          // User dropped files but none were valid
          const invalidExts = paths
            .map((p) => p.split('.').pop()?.toLowerCase())
            .filter((ext) => ext && !extensions.includes(ext));
          const uniqueExts = [...new Set(invalidExts)];
          const toastId = toast.error(
            `Unsupported file type${uniqueExts.length > 1 ? 's' : ''}: .${uniqueExts.join(', .')}`,
            {
              action: {
                label: 'Dismiss',
                onClick: () => toast.dismiss(toastId),
              },
            },
          );
        }
      } else {
        // leave or cancel
        setIsDragging(false);
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [extensions, onDrop]);

  return { isDragging };
}
