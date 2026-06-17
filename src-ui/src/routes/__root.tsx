import { createRootRoute, Outlet } from '@tanstack/react-router';
import { RootPageHeader } from '@/components/app-page-chrome';
import { Toaster } from '@/components/ui/sonner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { PixelProvider, usePixel } from '@/hooks/use-pixel';
import { ThemeProvider } from '@/components/theme-provider';
import SplitColumn from '@/components/ui/split-column';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <PixelProvider>
        <SidebarProvider className="flex min-h-svh w-full flex-col overflow-hidden">
          <RootPageHeader />
          <div className="flex min-h-0 min-w-0 flex-1">
            <AppSidebarWithContext />
            <SidebarInset className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] z-10">
              <SplitColumn>
                <Outlet />
              </SplitColumn>
              <Toaster position="bottom-center" richColors />
            </SidebarInset>
          </div>
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
      isRunning={pixel.isRunning}
    />
  );
}
