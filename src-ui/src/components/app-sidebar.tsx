import { useEffect, useState } from 'react';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import {
  IconBrandGithub,
  IconCalendar,
  IconCircleArrowUp,
  IconDeviceMobile,
  IconFolders,
  IconMovie,
  IconPhoto,
  IconSettings,
} from '@tabler/icons-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/theme-toggle';
import { Badge } from '@/components/ui/badge';

interface AppSidebarProps {
  isPixelConnected: boolean;
  isRunning: boolean;
}

const mediaRoutes = [
  {
    to: '/convert',
    label: 'Convert Media',
    icon: IconMovie,
    tooltip: 'Convert media for Pixel',
  },
  {
    to: '/split',
    label: 'Split Folder',
    icon: IconFolders,
    tooltip: 'Organize media into month or hash folders in place',
  },
  {
    to: '/browse',
    label: 'Browse by Day',
    icon: IconPhoto,
    tooltip: 'View media grouped and sorted by capture date',
    badge: 'DEV',
    hideInProd: true,
  },
  {
    to: '/fix-dates',
    label: 'Fix Dates',
    icon: IconCalendar,
    tooltip: 'Experimental: inspect dates and apply overrides',
    badge: 'BETA',
  },
] as const;

const deviceRoutes = [
  {
    to: '/transfer',
    label: 'Pixel Transfer',
    icon: IconDeviceMobile,
    tooltip: 'Transfer files to Pixel',
  },
] as const;

const appRoutes = [
  {
    to: '/settings',
    label: 'Settings',
    icon: IconSettings,
    tooltip: 'App settings',
  },
] as const;

const AppSidebar: React.FC<AppSidebarProps> = ({
  isPixelConnected,
  isRunning,
}) => {
  const [version, setVersion] = useState<string>('0');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const processRunningTooltip = 'Please wait for the current process to finish';

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('dev'));
  }, []);

  useEffect(() => {
    invoke<string | null>('check_for_update')
      .then(setUpdateVersion)
      .catch(() => {});
  }, []);

  return (
    <Sidebar
      variant="inset"
      className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] md:top-10 md:bottom-0 md:h-auto"
    >
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Media</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mediaRoutes
                .filter(
                  (route) =>
                    !(
                      'hideInProd' in route &&
                      route.hideInProd &&
                      import.meta.env.PROD
                    ),
                )
                .map((route) => {
                  const isActive = !!matchRoute({
                    to: route.to,
                    fuzzy: true,
                  });

                  return (
                    <SidebarMenuItem key={route.to}>
                      <SidebarMenuButton
                        isActive={isActive}
                        disabled={isRunning}
                        className={cn(isRunning && 'cursor-not-allowed')}
                        tooltip={
                          isRunning
                            ? {
                                children: processRunningTooltip,
                                hidden: false,
                              }
                            : route.tooltip
                        }
                        onClick={(event) => {
                          if (isRunning) {
                            event.preventDefault();
                            return;
                          }
                          void navigate({ to: route.to });
                        }}
                      >
                        <route.icon
                          className={cn(isActive && 'text-primary')}
                        />
                        <span className="grid flex-1 text-left text-sm leading-tight">
                          <span>{route.label}</span>
                        </span>
                        {'badge' in route ? (
                          <Badge
                            variant="secondary"
                            className="ml-auto h-4 rounded px-1.5 text-[10px]"
                          >
                            {route.badge}
                          </Badge>
                        ) : null}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Device</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {deviceRoutes.map((route) => {
                const isActive = !!matchRoute({
                  to: route.to,
                  fuzzy: true,
                });

                return (
                  <SidebarMenuItem key={route.to}>
                    <SidebarMenuButton
                      isActive={isActive}
                      disabled={isRunning}
                      size="lg"
                      className={cn(isRunning && 'cursor-not-allowed')}
                      tooltip={
                        isRunning
                          ? {
                              children: processRunningTooltip,
                              hidden: false,
                            }
                          : route.tooltip
                      }
                      onClick={(event) => {
                        if (isRunning) {
                          event.preventDefault();
                          return;
                        }
                        void navigate({ to: route.to });
                      }}
                    >
                      <route.icon
                        className={cn(
                          'self-start h-lh',
                          isActive && 'text-primary',
                        )}
                      />
                      <span className="grid flex-1 text-left text-sm leading-tight">
                        <span>{route.label}</span>
                        <span className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground tracking-wide">
                          {isPixelConnected ? 'Connected' : 'Not connected'}
                          <span
                            className={cn(
                              'size-1.5 rounded-full',
                              isPixelConnected
                                ? 'bg-green-500'
                                : 'bg-muted-foreground',
                            )}
                            aria-hidden="true"
                          />
                        </span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>App</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {appRoutes.map((route) => {
                const isActive = !!matchRoute({ to: route.to, fuzzy: true });

                return (
                  <SidebarMenuItem key={route.to}>
                    <SidebarMenuButton isActive={isActive}>
                      <route.icon
                        className={cn(
                          'self-start h-lh',
                          isActive && 'text-primary',
                        )}
                      />
                      {route.label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
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
              <IconCircleArrowUp size={13} />v{updateVersion} available
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
                <IconBrandGithub size={14} />
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
