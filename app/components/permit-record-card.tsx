import { CopyIcon } from "lucide-react";
import { Link } from "react-router";

import { DownloadPdfLink } from "~/components/download-pdf-link";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { formatMelbourneDateTime } from "~/lib/datetime";
import {
  permitRecordHeading,
  permitStatusBadges,
} from "~/lib/permit-display";
import type { PermitRunListItem } from "~/lib/permits.server";

type PermitRecordCardProps = {
  run: PermitRunListItem;
};

export function PermitRecordCard({ run }: PermitRecordCardProps) {
  const heading = permitRecordHeading({
    workDescription: run.workDescription,
    equipmentRef: run.equipmentRef,
    permitNumber: run.permitNumber,
  });
  const isArchived = Boolean(run.archivedAt);
  const statusBadges = permitStatusBadges({
    status: run.status,
    authorizedPersonnelCount: run.authorizedPersonnelCount,
    archivedAt: run.archivedAt,
  });

  const metaParts = [
    formatMelbourneDateTime(run.createdAt),
    run.equipmentRef &&
    run.workDescription &&
    run.equipmentRef !== heading
      ? run.equipmentRef
      : null,
    run.area,
    isArchived && run.archiveReason ? `Archived: ${run.archiveReason}` : null,
  ].filter(Boolean);

  return (
    <li className="rounded-lg border border-border/70 bg-white/70 px-4 py-3 transition-colors hover:border-brand/40 hover:bg-brand/5">
      <div className="flex flex-wrap items-start gap-3">
        <Link
          to={`/permits/runs/${run.id}`}
          className="min-w-0 flex-1"
        >
          <p className="font-heading text-lg font-semibold leading-snug text-brand-navy">
            {heading}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{run.title}</Badge>
            {statusBadges.map((badge) => (
              <Badge
                key={badge.kind}
                variant="outline"
                className={badge.className}
              >
                {badge.label}
              </Badge>
            ))}
            {run.permitNumber ? (
              <Badge variant="outline" className="tabular-nums">
                #{run.permitNumber}
              </Badge>
            ) : null}
          </div>
          {metaParts.length > 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          ) : null}
        </Link>
        <div className="flex flex-col items-end gap-2">
          <DownloadPdfLink href={`/permits/runs/${run.id}/pdf`} />
          {run.status === "CLOSED" && !isArchived ? (
            <Button asChild variant="secondary" size="sm">
              <Link to={`/permits/runs/${run.id}/copy`}>
                <CopyIcon data-icon="inline-start" />
                Copy to new permit
              </Link>
            </Button>
          ) : null}
        </div>
      </div>
    </li>
  );
}
