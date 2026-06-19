import { createRootRoute, Outlet } from '@tanstack/react-router';
import { RootPageHeader } from '@/components/app-page-chrome';
import { Toaster } from '@/components/ui/sonner';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import AppSidebar from '@/components/app-sidebar';
import { ThemeProvider } from '@/components/theme-provider';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <SidebarProvider className="flex min-h-svh w-full flex-col overflow-hidden">
        <RootPageHeader />
        <div className="flex min-h-0 min-w-0 flex-1">
          <AppSidebar />
          <SidebarInset className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] z-10">
            <Outlet />
            <Toaster position="bottom-center" richColors />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </ThemeProvider>
  );
}
