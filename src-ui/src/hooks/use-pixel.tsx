import {
  useState,
  useCallback,
  useEffect,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { open } from '@tauri-apps/plugin-dialog';
import { useCommand } from '../hooks/use-command';
import { useTerminal } from '../hooks/use-terminal';
import { IMAGE_EXTENSIONS, VIDEO_EXTENSIONS } from '../lib/constants';

export interface TransferPaths {
  source: string;
  destination: string;
}

export type ActiveOperation = 'pull' | 'push' | 'convert' | 'fix-dates' | null;

// Internal hook with the actual logic
const usePixelState = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [activeOperation, setActiveOperation] = useState<ActiveOperation>(null);
  const [transferPaths, setTransferPaths] = useState<TransferPaths | null>(
    null,
  );

  const { execute, isRunning, logs, clearLogs, logsEndRef } = useCommand({
    sidecar: 'binaries/itp',
  });

  const terminal = useTerminal();

  const checkConnection = useCallback(async () => {
    await execute(['check-adb'], {
      onFinish: (code) => setIsConnected(code === 0),
    });
  }, [execute]);

  // Check on mount
  useEffect(() => {
    checkConnection();
  }, []);

  const pushFiles = useCallback(async () => {
    if (!isConnected) return;
    const selected = await open({
      directory: false,
      multiple: true,
      filters: [
        {
          name: 'Media',
          extensions: [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS],
        },
      ],
      title: 'Select Files to Push to Pixel',
    });
    if (selected) {
      const paths = Array.isArray(selected) ? selected : [selected];
      setActiveOperation('push');
      setTransferPaths({
        source: paths[0],
        destination: '/sdcard/DCIM/Camera',
      });
      await execute(['push-to-pixel', '--jsonl', ...paths], {
        onFinish: () => setActiveOperation(null),
      });
    }
  }, [isConnected, execute]);

  const pushFolder = useCallback(async () => {
    if (!isConnected) return;
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Select Folder to Push to Pixel',
    });
    if (selected && typeof selected === 'string') {
      setActiveOperation('push');
      setTransferPaths({
        source: selected,
        destination: '/sdcard/DCIM/Camera',
      });
      await execute(['push-to-pixel', '--jsonl', selected], {
        onFinish: () => setActiveOperation(null),
      });
    }
  }, [isConnected, execute]);

  const pull = useCallback(async () => {
    if (!isConnected) return;
    const destination = await open({
      directory: true,
      multiple: false,
      title: 'Select Destination for Camera Files',
    });
    if (destination && typeof destination === 'string') {
      setActiveOperation('pull');
      setTransferPaths({ source: '/sdcard/DCIM/Camera', destination });
      await execute(['pull-from-pixel', '--jsonl', destination], {
        onFinish: () => setActiveOperation(null),
      });
    }
  }, [isConnected, execute]);

  const shell = useCallback(async () => {
    if (!isConnected) return;
    // Open ADB shell in native terminal (interactive session)
    await terminal.openInTerminal('adb', ['shell']);
  }, [isConnected, terminal]);

  const convert = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setActiveOperation('convert');
      await execute(['convert', ...paths, '--jsonl'], {
        onFinish: () => setActiveOperation(null),
      });
    },
    [execute],
  );

  const convertInTerminal = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      // Open the native terminal with the itp convert command
      await terminal.openInTerminal('itp', ['convert', ...paths]);
    },
    [terminal],
  );

  const fixDates = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      setActiveOperation('fix-dates');
      await execute(['fix-dates', ...paths, '--jsonl'], {
        onFinish: () => setActiveOperation(null),
      });
    },
    [execute],
  );

  const fixDatesInTerminal = useCallback(
    async (paths: string[]) => {
      if (paths.length === 0) return;
      // Open the native terminal with the itp fix-dates command
      await terminal.openInTerminal('itp', ['fix-dates', ...paths]);
    },
    [terminal],
  );

  /** Open the current operation in native terminal */
  const openActiveInTerminal = useCallback(async () => {
    if (!transferPaths) return;

    if (activeOperation === 'pull') {
      // adb pull /sdcard/DCIM/Camera/ <destination>
      await terminal.openInTerminal('adb', [
        'pull',
        transferPaths.source + '/',
        transferPaths.destination,
      ]);
    } else if (activeOperation === 'push') {
      // adb push <source> /sdcard/DCIM/Camera/
      await terminal.openInTerminal('adb', [
        'push',
        transferPaths.source,
        transferPaths.destination + '/',
      ]);
    }
  }, [activeOperation, transferPaths, terminal]);

  // Wrap clearLogs to also clear transfer context
  const clearAll = useCallback(() => {
    clearLogs();
    setTransferPaths(null);
  }, [clearLogs]);

  return {
    isConnected,
    isRunning,
    logs,
    clearLogs: clearAll,
    logsEndRef,
    checkConnection,
    pushFiles,
    pushFolder,
    pull,
    shell,
    convert,
    convertInTerminal,
    fixDates,
    fixDatesInTerminal,
    terminalName: terminal.terminalName,
    terminalReady: terminal.isReady,
    // New exports
    activeOperation,
    transferPaths,
    openActiveInTerminal,
  };
};

// Context Setup
type PixelContextValue = ReturnType<typeof usePixelState>;

const PixelContext = createContext<PixelContextValue | null>(null);

interface PixelProviderProps {
  children: ReactNode;
}

export const PixelProvider: React.FC<PixelProviderProps> = ({ children }) => {
  const pixel = usePixelState();
  return (
    <PixelContext.Provider value={pixel}>{children}</PixelContext.Provider>
  );
};

// Public Hook (Consumer)
const usePixel = (): PixelContextValue => {
  const context = useContext(PixelContext);
  if (!context) {
    throw new Error('usePixel must be used within a PixelProvider');
  }
  return context;
};

export default usePixel;
