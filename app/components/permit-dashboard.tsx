import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { PermitRecordCard } from "~/components/permit-record-card";
import { needsAuthorizedPersonnel } from "~/lib/permit-display";
import type { PermitRunListItem } from "~/lib/permits.server";
import { cn } from "~/lib/utils";

type Props = {
  pendingPermits: PermitRunListItem[];
  openPermits: PermitRunListItem[];
  /** Compact card layout for the home page. */
  compact?: boolean;
  className?: string;
};

function activeSummary(
  pendingPermits: PermitRunListItem[],
  openPermits: PermitRunListItem[],
): string {
  const totalActive = pendingPermits.length + openPermits.length;
  if (totalActive === 0) {
    return "No active permits right now";
  }

  const pendingPersonnel = [...pendingPermits, ...openPermits].filter((run) =>
    needsAuthorizedPersonnel(run.authorizedPersonnelCount),
  ).length;

  return [
    pendingPermits.length > 0
      ? `${pendingPermits.length} pending authorization`
      : null,
    pendingPersonnel > 0
      ? `${pendingPersonnel} pending authorized personnel`
      : null,
    openPermits.length > 0 ? `${openPermits.length} open` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function PermitDashboard({
  pendingPermits,
  openPermits,
  compact = false,
  className,
}: Props) {
  if (compact) {
    return (
      <Card className={cn(className)}>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-xl text-brand-navy">
                Permits
              </CardTitle>
              <CardDescription className="mt-1">
                {activeSummary(pendingPermits, openPermits)}
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/permits/dashboard">Dashboard</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PermitList
            heading="Pending authorization"
            empty="None waiting for sign-off."
            permits={pendingPermits}
            limit={5}
          />
          <PermitList
            heading="Open"
            empty="None open for close-out."
            permits={openPermits}
            limit={5}
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/permits">Issue a permit</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/permits/history">Records</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={cn("grid gap-10", className)}>
      <section aria-labelledby="pending-permits-heading">
        <div className="mb-4">
          <h2
            id="pending-permits-heading"
            className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Pending authorization
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Waiting for the required authorisation signatures (2 or 3,
            depending on the permit type) and at least one Authorized Personnel
            Performing Work entry before work is fully ready.
          </p>
        </div>
        <PermitList
          permits={pendingPermits}
          empty="No permits waiting for authorization."
        />
      </section>

      <section aria-labelledby="open-permits-heading">
        <div className="mb-4">
          <h2
            id="open-permits-heading"
            className="font-heading text-2xl font-semibold tracking-tight text-brand-navy"
          >
            Open permits
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Authorized permits in progress (max 12 hours from start to end).
            Close out when work is finished; remaining sign-offs can still be
            added when only two were required to open. Permits still missing
            Authorized Personnel Performing Work show that badge until at least
            one person is recorded.
          </p>
        </div>
        <PermitList
          permits={openPermits}
          empty="No open permits right now."
        />
      </section>
    </div>
  );
}

function PermitList({
  heading,
  permits,
  empty,
  limit,
}: {
  heading?: string;
  permits: PermitRunListItem[];
  empty: string;
  limit?: number;
}) {
  const items = limit != null ? permits.slice(0, limit) : permits;
  const remaining =
    limit != null && permits.length > limit ? permits.length - limit : 0;

  return (
    <div className="grid gap-2">
      {heading ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-brand-navy">{heading}</h3>
          {permits.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {permits.length}
            </span>
          ) : null}
        </div>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid gap-3">
          {items.map((permit) => (
            <PermitRecordCard key={permit.id} run={permit} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{empty}</p>
      )}

      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">
          +{remaining} more on the{" "}
          <Link
            to="/permits/dashboard"
            className="underline-offset-4 hover:underline"
          >
            dashboard
          </Link>
        </p>
      ) : null}
    </div>
  );
}
