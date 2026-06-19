import {
  IconArchive,
  IconBell,
  IconDots,
  IconHome,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSettings,
  IconUser,
} from '@tabler/icons-react';
import { useMatchRoute, useNavigate } from '@tanstack/react-router';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { ThemeToggle } from '@/components/theme-toggle';

export default function AppSidebar() {
  const matchRoute = useMatchRoute();
  const navigate = useNavigate();
  const isHomeActive = !!matchRoute({ to: '/', fuzzy: false });

  return (
    <Sidebar
      variant="inset"
      className="select-none [-webkit-user-select:none] [-webkit-touch-callout:none] md:top-10 md:bottom-0 md:h-auto"
    >
      <SidebarHeader>
        <SidebarInput placeholder="Search" aria-label="Search" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <div className="md:hidden sticky top-0 z-60 h-10 w-full bg-sidebar" />
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupAction aria-label="Add item">
            <IconPlus />
          </SidebarGroupAction>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={isHomeActive}
                  tooltip="Home"
                  onClick={() => void navigate({ to: '/' })}
                >
                  <IconHome />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Inbox">
                  <IconInbox />
                  <span>Inbox</span>
                </SidebarMenuButton>
                <SidebarMenuBadge>3</SidebarMenuBadge>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Actions">
                  <IconBell />
                  <span>With Action</span>
                </SidebarMenuButton>
                <SidebarMenuAction showOnHover aria-label="More options">
                  <IconDots />
                </SidebarMenuAction>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Projects">
                  <IconArchive />
                  <span>Nested Items</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#" isActive>
                      <span>Overview</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                  <SidebarMenuSubItem>
                    <SidebarMenuSubButton href="#" size="sm">
                      <span>Details</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </SidebarMenuSub>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>States</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuSkeleton showIcon />
              <SidebarMenuItem>
                <SidebarMenuButton disabled tooltip="Disabled item">
                  <IconSettings />
                  <span>Disabled</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="Account">
              <IconUser />
              <span className="grid flex-1 text-left text-sm leading-tight">
                <span className="font-medium">Template User</span>
                <span className="text-muted-foreground text-xs">Local</span>
              </span>
              <ThemeToggle />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
