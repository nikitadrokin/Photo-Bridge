import { createRootRoute } from '@tanstack/react-router';
import {
  AppPageChrome,
  PageHeaderActionsProvider,
} from '@/components/app-page-chrome';
import { Toaster } from '@/components/ui/sonner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { PixelProvider, usePixel } from '@/hooks/use-pixel';
import { ThemeProvider } from '@/components/theme-provider';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <PixelProvider>
        <PageHeaderActionsProvider>
          <SidebarProvider>
            <AppSidebarWithContext />
            <SidebarInset className="flex flex-col">
              <AppPageChrome />
              <Toaster position="bottom-center" richColors />
            </SidebarInset>
          </SidebarProvider>
        </PageHeaderActionsProvider>
      </PixelProvider>
    </ThemeProvider>
  );
}

function AppSidebarWithContext() {
  const pixel = usePixel();
  return (
    <AppSidebar
      isPixelConnected={pixel.isConnected}
      onCheckConnection={pixel.checkConnection}
      isRunning={pixel.isRunning}
      isConnectionCheckPending={pixel.isConnectionCheckPending}
    />
  );
}
