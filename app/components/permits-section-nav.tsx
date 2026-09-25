import { Link, useLocation } from "react-router";

import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  activePermitsSectionNavTo,
  permitsSectionNavItems,
  type NavCapabilities,
} from "~/lib/nav";
import { cn } from "~/lib/utils";

type Props = {
  canManageOperators: boolean;
  className?: string;
};

export function PermitsSectionNav({ canManageOperators, className }: Props) {
  const location = useLocation();
  const capabilities: NavCapabilities = {
    signedIn: true,
    canReview: false,
    canManageOperators,
    canManageUsers: false,
    canManageRoles: false,
  };
  const items = permitsSectionNavItems(capabilities);
  const activeTo = activePermitsSectionNavTo(location, items);

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Permits section"
      className={cn("mb-6 w-full overflow-x-auto", className)}
    >
      <Tabs value={activeTo ?? items[0]!.to} className="w-full gap-0">
        <TabsList
          variant="line"
          className="h-auto w-full min-w-max justify-start gap-0 border-b border-border/80 bg-transparent p-0"
        >
          {items.map((item) => (
            <TabsTrigger
              key={item.to}
              value={item.to}
              asChild
              className={cn(
                "rounded-none px-3 py-2.5 text-sm text-muted-foreground after:bottom-0 after:h-0.5 after:bg-brand-navy",
                "hover:text-brand-navy data-active:text-brand-navy",
              )}
            >
              <Link to={item.to}>{item.label}</Link>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </nav>
  );
}
