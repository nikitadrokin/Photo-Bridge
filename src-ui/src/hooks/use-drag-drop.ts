import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { toast } from 'sonner';
import {
  fileExtension,
  hasValidExtension,
  pathIsDirectory,
} from '@/lib/path';

interface UseDragDropOptions {
  /** Valid file extensions (without dot) */
  extensions: Array<string>;
  /** Callback when valid paths are dropped */
  onDrop: (paths: Array<string>) => void;
}

async function filterValidDropPaths(
  paths: readonly string[],
  extensions: readonly string[],
): Promise<Array<string>> {
  const validPaths: Array<string> = [];

  for (const path of paths) {
    if (await pathIsDirectory(path)) {
      validPaths.push(path);
      continue;
    }

    if (hasValidExtension(path, extensions)) {
      validPaths.push(path);
    }
  }

  return validPaths;
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

        void (async () => {
          const validPaths = await filterValidDropPaths(paths, extensions);

          if (validPaths.length > 0) {
            onDrop(validPaths);
            return;
          }

          if (paths.length === 0) {
            return;
          }

          const invalidExts: Array<string> = [];
          for (const path of paths) {
            if (await pathIsDirectory(path)) {
              continue;
            }
            const ext = fileExtension(path);
            if (ext && !extensions.includes(ext)) {
              invalidExts.push(ext);
            }
          }

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
        })();
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
