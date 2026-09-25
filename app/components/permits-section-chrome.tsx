import { Fragment } from "react";
import { Link, useLocation } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "~/components/ui/navigation-menu";
import {
  buildNavItems,
  buildPermitsBreadcrumbs,
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
import { cn } from "~/lib/utils";

type Props = {
  user: AuthUser;
  pendingCount?: number;
  /** Extra trail after the section page (e.g. manage form title). */
  trail?: { label: string; to?: string }[];
};

export function PermitsSectionChrome({
  user,
  pendingCount = 0,
  trail = [],
}: Props) {
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
  const crumbs = buildPermitsBreadcrumbs(location.pathname, trail);

  if (!permitsGroup) {
    return null;
  }

  return (
    <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <Breadcrumb className="mb-3">
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                {crumb.to ? (
                  <BreadcrumbLink asChild>
                    <Link
                      to={crumb.to}
                      className="text-muted-foreground hover:text-brand-navy"
                    >
                      {crumb.label}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="text-brand-navy">
                    {crumb.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <NavigationMenu
        viewport={false}
        className="max-w-none justify-start"
        aria-label="Permits section"
      >
        <NavigationMenuList className="h-auto w-full flex-wrap justify-start gap-0 border-b border-border/70">
          {permitsGroup.children.map((child) => {
            const active = pathMatches(location, child.to);
            return (
              <NavigationMenuItem key={child.to}>
                <NavigationMenuLink
                  asChild
                  active={active}
                  className={cn(
                    navigationMenuTriggerStyle(),
                    "rounded-none border-b-2 border-transparent bg-transparent px-3 text-muted-foreground shadow-none hover:bg-transparent hover:text-brand-navy focus:bg-transparent focus:text-brand-navy data-active:border-brand-navy data-active:bg-transparent data-active:text-brand-navy data-active:hover:bg-transparent data-active:focus:bg-transparent",
                  )}
                >
                  <Link to={child.to}>{child.label}</Link>
                </NavigationMenuLink>
              </NavigationMenuItem>
            );
          })}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
