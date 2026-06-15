import { createRootRoute, Outlet } from '@tanstack/react-router';
import { RootPageHeader } from '@/components/app-page-chrome';
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
        <SidebarProvider className="flex min-h-svh w-full flex-col overflow-hidden">
          <RootPageHeader />
          <div className="flex min-h-0 min-w-0 flex-1">
            <AppSidebarWithContext />
            <SidebarInset className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] z-10">
              <main className="flex-1 p-4">
                <div className="mx-auto grid grid-cols-1 lg:grid-cols-2 max-w-6xl gap-8">
                  <Outlet />
                </div>
              </main>
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
