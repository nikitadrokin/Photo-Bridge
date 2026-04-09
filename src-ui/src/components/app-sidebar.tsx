import { useEffect, useState } from 'react';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
// import { getVersion } from '@tauri-apps/api/app';
// import { invoke } from '@tauri-apps/api/core';
import {
  ArrowCircleUp,
  ArrowsClockwise,
  CalendarBlank,
  DeviceMobile,
  FilmStrip,
  Gear,
  GithubLogo,
  RoadHorizon,
} from '@phosphor-icons/react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import useIsFullscreen from '@/hooks/use-is-fullscreen';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/theme-toggle';

interface AppSidebarProps {
  isPixelConnected: boolean;
  onCheckConnection: (opts?: { interactive?: boolean }) => void;
  isRunning: boolean;
  isConnectionCheckPending: boolean;
}

const isDev = import.meta.env.DEV;

const routes = [
  {
    to: '/convert',
    label: 'Convert Media',
    icon: FilmStrip,
    tooltip: 'Convert media for Pixel',
  },
  {
    to: '/fix-dates',
    label: 'Fix Dates (Google Photos only)',
    icon: CalendarBlank,
    tooltip: 'Experimental: inspect dates and apply overrides',
  },
  {
    to: '/transfer',
    label: 'Pixel Transfer',
    icon: DeviceMobile,
    tooltip: 'Transfer files to Pixel',
  },
  {
    to: '/roadmap',
    label: 'Roadmap',
    icon: RoadHorizon,
    tooltip: 'View planned and upcoming features',
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: Gear,
    tooltip: 'App settings',
  },
] as const;

const AppSidebar: React.FC<AppSidebarProps> = ({
  isPixelConnected,
  onCheckConnection,
  isRunning,
  isConnectionCheckPending,
}) => {
  const [version, setVersion] = useState<string>('0');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const isFullscreen = useIsFullscreen();
  const isMobile = useIsMobile();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  // useEffect(() => {
  //   getVersion()
  //     .then(setVersion)
  //     .catch(() => setVersion('dev'));
  // }, []);

  // useEffect(() => {
  //   invoke<string | null>('check_for_update')
  //     .then(setUpdateVersion)
  //     .catch(() => {});
  // }, []);

  return (
    <Sidebar
      variant="inset"
      className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] md:top-14 md:bottom-0 md:h-auto"
    >
      <SidebarContent>
        {/* Core */}
        <SidebarGroup>
          <SidebarGroupLabel>Core</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {routes.map((route) => {
                if (route.to === '/roadmap' && !isDev) return null;
                const isActive = !!matchRoute({ to: route.to, fuzzy: true });

                return (
                  <SidebarMenuItem key={route.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      tooltip={route.tooltip}
                      onClick={() => navigate({ to: route.to })}
                    >
                      <route.icon
                        weight={isActive ? 'duotone' : 'regular'}
                        className={cn(isActive && 'text-primary')}
                      />
                      <span>{route.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Device Status */}
        <SidebarGroup>
          <SidebarGroupLabel>Device</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    onCheckConnection({ interactive: true });
                  }}
                  disabled={isRunning || isConnectionCheckPending}
                  tooltip="Check Pixel connection via ADB"
                >
                  <DeviceMobile
                    weight={isPixelConnected ? 'duotone' : 'regular'}
                    className={cn(
                      isPixelConnected
                        ? 'text-green-500'
                        : 'text-muted-foreground',
                    )}
                  />
                  <span>
                    {isPixelConnected ? 'Connected' : 'Not Connected'}
                  </span>
                  <ArrowsClockwise
                    className={cn(
                      'ml-auto h-4 w-4',
                      isConnectionCheckPending && 'animate-spin',
                    )}
                  />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex flex-col gap-3 text-xs text-muted-foreground">
          {updateVersion && (
            <a
              href="https://github.com/nikitadrokin/Photo-Bridge/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-primary hover:underline"
            >
              <ArrowCircleUp size={13} weight="duotone" />v{updateVersion}{' '}
              available
            </a>
          )}

          <ThemeToggle />

          <div className="flex items-center justify-between">
            <span>
              Made with 🫶🏻 by{' '}
              <a
                href="https://nkdr.me"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Nikita
              </a>
            </span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/nikitadrokin/photo-bridge"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
                aria-label="View source on GitHub"
              >
                <GithubLogo size={14} />
              </a>
              {version ? (
                <span className="text-muted-foreground">v{version}</span>
              ) : null}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
