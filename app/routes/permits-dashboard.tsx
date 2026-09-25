import type { Route } from "./+types/permits-dashboard";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { PermitDashboard } from "~/components/permit-dashboard";
import { PermitsSectionChrome } from "~/components/permits-section-chrome";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import {
  listOpenPermitRuns,
  listPendingAuthorizationPermitRuns,
} from "~/lib/permits.server";
import { canReviewRuns } from "~/lib/roles";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Permit dashboard") },
    {
      name: "description",
      content:
        "Active permits awaiting authorization or close-out at Hercules 1612.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/permits/dashboard");
  const [pendingPermits, openPermits, pendingCount] = await Promise.all([
    listPendingAuthorizationPermitRuns({ limit: 50 }),
    listOpenPermitRuns({ limit: 50 }),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    pendingPermits,
    openPermits,
    pendingCount,
  };
}

export default function PermitsDashboardPage({
  loaderData,
}: Route.ComponentProps) {
  const { pendingPermits, openPermits, user, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <PermitsSectionChrome user={user} pendingCount={pendingCount} />
        <section className="mb-12 max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-brand-navy sm:text-5xl">
            Dashboard
          </h1>
          <p className="mt-3 text-base text-muted-foreground sm:text-lg">
            Active permits that need authorization or close-out. Closed permits
            are in Records.
          </p>
        </section>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500">
          <PermitDashboard
            pendingPermits={pendingPermits}
            openPermits={openPermits}
          />
        </div>
      </main>
    </div>
  );
}
