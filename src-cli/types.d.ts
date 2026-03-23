declare module '@devicefarmer/adbkit' {
  export const Adb: {
    createClient: () => {
      listDevices: () => Promise<Array<{ id: string }>>;
      getDevice: (id: string) => {
        syncService: () => Promise<{
          pushFile: (
            source: string,
            target: string,
          ) => {
            on: (event: string, listener: (...args: unknown[]) => void) => void;
          };
          end: () => void;
        }>;
      };
    };
  };
}
