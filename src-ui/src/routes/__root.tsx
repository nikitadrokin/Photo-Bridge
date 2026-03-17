import { Outlet, createRootRoute } from '@tanstack/react-router';
import { Toaster } from '@/components/ui/sonner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { PixelProvider, usePixel } from '@/contexts/pixel-context';
import { ThemeProvider } from '@/components/theme-provider';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <PixelProvider>
        <SidebarProvider>
          <AppSidebarWithContext />
          <SidebarInset className="flex flex-col">
            <Outlet />
            <Toaster position="bottom-center" richColors />
          </SidebarInset>
        </SidebarProvider>
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
    />
  );
}
