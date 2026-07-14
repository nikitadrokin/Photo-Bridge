import { useEffect, useRef, useState } from 'react';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import {
  IconBrandGithub,
  IconCalendar,
  IconCircleArrowDown,
  IconDeviceMobile,
  IconDeviceMobileCog,
  IconFolders,
  IconLoader2,
  IconMovie,
  IconPhoto,
  IconRefresh,
  IconSettings,
} from '@tabler/icons-react';
import { toast } from 'sonner';
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
import { Button } from '@/components/ui/button';

interface AppSidebarProps {
  isPixelConnected: boolean;
  isRunning: boolean;
}

type AppUpdateResponse = {
  status: 'available' | 'prepared' | 'upToDate' | 'restarting';
  version: string | null;
};

type AppUpdateDownloadProgress = {
  downloaded: number;
  total: number | null;
};

const APP_UPDATE_DOWNLOAD_PROGRESS_EVENT = 'app-update://download-progress';

type UpdateButtonState =
  | 'hidden'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'installing';

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
    to: '/fix-dates',
    label: 'Fix Dates',
    icon: IconCalendar,
    tooltip: 'Experimental: inspect dates and apply overrides',
    badge: 'BETA',
  },
  {
    to: '/browse',
    label: 'Browse Media',
    icon: IconPhoto,
    tooltip: 'View media grouped and sorted by capture date',
  },
] as const;

const deviceRoutes = [
  {
    to: '/transfer-media',
    label: 'Transfer Media',
    icon: IconDeviceMobile,
    tooltip: 'Transfer files to Pixel',
  },
  {
    to: '/manage-device',
    label: 'Manage Device',
    icon: IconDeviceMobileCog,
    tooltip: 'Browse storage and purge the Pixel camera roll',
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
  const [updateButtonState, setUpdateButtonState] =
    useState<UpdateButtonState>('hidden');
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const hasCheckedForUpdate = useRef(false);
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const processRunningTooltip = 'Please wait for the current process to finish';
  const isDownloadingUpdate = updateButtonState === 'downloading';
  const isInstallingUpdate = updateButtonState === 'installing';
  const isUpdateButtonLoading = isDownloadingUpdate || isInstallingUpdate;
  const updateButtonLabel = getUpdateButtonLabel(
    updateButtonState,
    updateVersion,
  );

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => setVersion('dev'));
  }, []);

  useEffect(() => {
    if (hasCheckedForUpdate.current) {
      return;
    }
    hasCheckedForUpdate.current = true;

    invoke<AppUpdateResponse>('check_app_update')
      .then((response) => {
        if (response.status !== 'available') {
          return;
        }
        setUpdateVersion(response.version);
        setUpdateButtonState('available');
        toast.info(
          response.version
            ? `Photo Bridge v${response.version} is available.`
            : 'A Photo Bridge update is available.',
          {
            description: 'Download it from the sidebar when you are ready.',
          },
        );
      })
      .catch((error) => {
        // The startup check is silent by design; just log the failure.
        console.warn('Update check failed:', error);
      });
  }, []);

  async function handleUpdateClick() {
    if (isUpdateButtonLoading || isRunning) {
      return;
    }

    if (updateButtonState === 'ready') {
      await installPreparedUpdate();
      return;
    }

    if (updateButtonState === 'available') {
      await downloadUpdate();
    }
  }

  async function downloadUpdate() {
    setUpdateButtonState('downloading');
    const toastId = toast.loading(
      'Downloading update...',
      dismissibleToastOptions(() => toastId),
    );

    const unlisten = await listen<AppUpdateDownloadProgress>(
      APP_UPDATE_DOWNLOAD_PROGRESS_EVENT,
      (event) => {
        toast.loading(
          formatDownloadProgress(
            event.payload.downloaded,
            event.payload.total,
          ),
          { id: toastId, ...dismissibleToastOptions(() => toastId) },
        );
      },
    );

    try {
      const response = await invoke<AppUpdateResponse>('prepare_app_update');

      if (response.status === 'upToDate') {
        // The release disappeared between the startup check and the download.
        setUpdateVersion(null);
        setUpdateButtonState('hidden');
        toast.success('Photo Bridge is up to date.', { id: toastId });
        return;
      }

      setUpdateVersion(response.version);
      setUpdateButtonState('ready');
      toast.success(
        response.version
          ? `Photo Bridge v${response.version} is downloaded and ready to install.`
          : 'A Photo Bridge update is downloaded and ready to install.',
        { id: toastId },
      );
    } catch (error) {
      setUpdateButtonState('available');
      toast.error(formatUpdateError(error), { id: toastId });
    } finally {
      unlisten();
    }
  }

  async function installPreparedUpdate() {
    setUpdateButtonState('installing');
    const toastId = toast.loading(
      updateVersion
        ? `Installing v${updateVersion} and restarting...`
        : 'Installing update and restarting...',
      dismissibleToastOptions(() => toastId),
    );

    try {
      const response = await invoke<AppUpdateResponse>(
        'install_prepared_app_update',
      );

      toast.success(
        response.version
          ? `Installed v${response.version}. Restarting...`
          : 'Installed update. Restarting...',
        { id: toastId, duration: 1500 },
      );
    } catch (error) {
      // The backend consumes the prepared update on any install attempt, so a
      // failure means there is nothing left to install — offer the download
      // again.
      setUpdateButtonState('available');
      toast.error(formatUpdateError(error), { id: toastId });
    }
  }

  return (
    <Sidebar
      variant="inset"
      className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] md:top-10 md:bottom-0 md:h-auto"
    >
      <SidebarContent>
        <SidebarGroup>
          <div className="md:hidden sticky top-0 z-60 w-full h-10 bg-sidebar"></div>
          <SidebarGroupLabel>Media</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mediaRoutes.map((route) => {
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
                      <route.icon className={cn(isActive && 'text-primary')} />
                      <span>{route.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
              <SidebarMenuItem>
                <SidebarMenuButton
                  disabled
                  className="cursor-default opacity-100 pointer-events-none"
                  tooltip={
                    isPixelConnected
                      ? 'Pixel is connected'
                      : 'Pixel is not connected'
                  }
                >
                  <span className="flex items-center justify-center size-4 shrink-0">
                    <span
                      className={cn(
                        'size-1.5 rounded-full shrink-0 block',
                        isPixelConnected
                          ? 'bg-green-500'
                          : 'bg-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {isPixelConnected ? 'Connected' : 'Not connected'}
                  </span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
          {updateButtonState !== 'hidden' ? (
            <Button
              type="button"
              size="sm"
              variant={updateButtonState === 'ready' ? 'default' : 'outline'}
              className={cn(
                'w-full justify-start',
                isRunning && 'cursor-not-allowed',
              )}
              disabled={isUpdateButtonLoading || isRunning}
              title={isRunning ? processRunningTooltip : undefined}
              onClick={handleUpdateClick}
            >
              {isUpdateButtonLoading ? (
                <IconLoader2 className="size-3.5 animate-spin" />
              ) : updateButtonState === 'ready' ? (
                <IconRefresh className="size-3.5" />
              ) : (
                <IconCircleArrowDown className="size-3.5" />
              )}
              {updateButtonLabel}
            </Button>
          ) : null}

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

function getUpdateButtonLabel(
  state: UpdateButtonState,
  availableVersion: string | null,
) {
  switch (state) {
    case 'available':
      return availableVersion
        ? `Download v${availableVersion}`
        : 'Download update';
    case 'downloading':
      return availableVersion
        ? `Downloading v${availableVersion}...`
        : 'Downloading update...';
    case 'ready':
      return availableVersion
        ? `Install v${availableVersion}`
        : 'Install update';
    case 'installing':
      return availableVersion
        ? `Installing v${availableVersion}...`
        : 'Installing update...';
    case 'hidden':
      return '';
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function formatDownloadProgress(downloaded: number, total: number | null) {
  if (typeof total === 'number' && total > 0) {
    const pct = Math.min(100, Math.round((downloaded / total) * 100));
    return `Downloading update... ${pct}%`;
  }

  return `Downloading update... ${formatBytes(downloaded)}`;
}

function formatBytes(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function formatUpdateError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Update failed.';
}

function dismissibleToastOptions(getToastId: () => string | number) {
  return {
    action: {
      label: 'Dismiss',
      onClick: () => toast.dismiss(getToastId()),
    },
  };
}

export default AppSidebar;
