import { Link, useLocation } from "react-router";
import {
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "~/components/ui/sidebar";
import {
  buildNavItems,
  findNavGroup,
  pathMatches,
} from "~/lib/nav";
import {
  canManageOperators,
  canManageRoles,
  canManageUsers,
  canReviewRuns,
} from "~/lib/roles";
import type { AuthUser } from "~/lib/user.server";

const PERMIT_NAV_ICONS: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboardIcon,
  Forms: FileTextIcon,
  Records: HistoryIcon,
  Manage: WrenchIcon,
  Settings: SettingsIcon,
};

type Props = {
  user: AuthUser;
  pendingCount?: number;
};

export function PermitsSidebarNav({ user, pendingCount = 0 }: Props) {
  const location = useLocation();
  const navItems = buildNavItems({
    signedIn: true,
    canReview: canReviewRuns(user.role),
    canManageOperators: canManageOperators(user.role),
    canManageUsers: canManageUsers(user.role),
    canManageRoles: canManageRoles(user.role),
    pendingCount,
  });
  const permitsGroup = findNavGroup(navItems, "permits");

  if (!permitsGroup) {
    return null;
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2 px-1 text-brand-navy group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <ClipboardListIcon className="size-4 shrink-0" />
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-semibold tracking-tight">
              {permitsGroup.label}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Section navigation
            </p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Pages</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {permitsGroup.children.map((child) => {
                const Icon = PERMIT_NAV_ICONS[child.label] ?? FileTextIcon;
                const active = pathMatches(location, child.to);
                return (
                  <SidebarMenuItem key={child.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={child.label}
                      className="text-brand-navy data-active:bg-sidebar-accent data-active:text-brand-navy"
                    >
                      <Link to={child.to}>
                        <Icon />
                        <span>{child.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
