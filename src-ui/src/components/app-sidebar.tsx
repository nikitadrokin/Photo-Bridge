import { useEffect, useState } from 'react';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import { getVersion } from '@tauri-apps/api/app';
import {
  ArrowsClockwise,
  DeviceMobile,
  FilmStrip,
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
  onCheckConnection: () => void;
  isRunning: boolean;
}

const isDev = import.meta.env.DEV;

const routes = [
  {
    to: '/convert',
    label: 'Convert Media (old)',
    icon: FilmStrip,
    tooltip: 'Convert media files for Pixel compatibility',
  },
  {
    to: '/convert-new',
    label: 'Convert Media (new)',
    icon: FilmStrip,
    tooltip: 'Convert media files for Pixel compatibility',
  },
  {
    to: '/transfer',
    label: 'Pixel Transfer',
    icon: DeviceMobile,
    tooltip: 'Push and pull files to/from your Pixel',
  },
  {
    to: '/roadmap',
    label: 'Roadmap',
    icon: RoadHorizon,
    tooltip: 'View planned and upcoming features',
  },
] as const;

const AppSidebar: React.FC<AppSidebarProps> = ({
  isPixelConnected,
  onCheckConnection,
  isRunning,
}) => {
  const [version, setVersion] = useState<string>('');
  const isFullscreen = useIsFullscreen();
  const isMobile = useIsMobile();
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('dev'));
  }, []);

  return (
    <Sidebar variant="floating">
      <SidebarHeader className="px-4 pt-2.5">
        <span
          className={cn(
            'font-semibold text-sm inline-block',
            !isFullscreen && 'ml-18',
            isMobile && 'ml-20 mt-2',
          )}
        >
          iPhone to Pixel
        </span>
      </SidebarHeader>
      <SidebarSeparator className="mt-2.5" />
      <SidebarContent>
        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
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
                        className={cn(
                          isActive && 'text-primary',
                          !isActive &&
                            route.to === '/transfer' &&
                            (isPixelConnected
                              ? 'text-green-500'
                              : 'text-muted-foreground'),
                        )}
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
                  onClick={onCheckConnection}
                  disabled={isRunning}
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
                      isRunning && 'animate-spin',
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
          <ThemeToggle />
          <div className="flex items-center justify-between">
            <span>
              Made with 🫶🏻 by{' '}
              <a
                href="https://github.com/nikitadrokin"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Nikita
              </a>
            </span>
            <div className="flex items-center gap-2">
              <a
                href="https://github.com/nikitadrokin/iphone-to-pixel"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-primary hover:underline"
              >
                <GithubLogo size={14} />
              </a>
              {version && (
                <span className="text-muted-foreground">v{version}</span>
              )}
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;
