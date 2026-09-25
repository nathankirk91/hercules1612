import { Outlet } from "react-router";

import type { Route } from "./+types/permits-hub-layout";

import { AppHeader } from "~/components/app-header";
import { PermitsSidebarNav } from "~/components/permits-sidebar-nav";
import { Separator } from "~/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "~/components/ui/sidebar";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import { canReviewRuns } from "~/lib/roles";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, new URL(request.url).pathname);
  const pendingCount = canReviewRuns(user.role)
    ? await countPendingRuns()
    : 0;

  return { user, pendingCount };
}

export default function PermitsHubLayout({
  loaderData,
}: Route.ComponentProps) {
  const { user, pendingCount } = loaderData;

  return (
    <div className="app-shell flex min-h-screen flex-col">
      <AppHeader user={user} pendingCount={pendingCount} />
      <SidebarProvider className="min-h-0 flex-1">
        <PermitsSidebarNav user={user} pendingCount={pendingCount} />
        <SidebarInset className="min-w-0 bg-transparent">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/70 bg-white/80 px-4 backdrop-blur-sm md:hidden">
            <SidebarTrigger className="-ml-1 text-brand-navy" />
            <Separator orientation="vertical" className="mr-1 h-4" />
            <span className="text-sm font-medium text-brand-navy">Permits</span>
          </div>
          <Outlet />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
