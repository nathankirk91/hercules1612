import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatMelbourneTime, formatMelbourneYmd } from "~/lib/datetime";
import type { TankDaySummary } from "~/lib/tank-levels.server";
import { cn } from "~/lib/utils";

type Props = {
  summary: TankDaySummary;
  className?: string;
};

export function TankLevelsHomeCard({ summary, className }: Props) {
  const dayLabel = formatMelbourneYmd(summary.date) ?? summary.date;
  const lastTime = summary.lastUpdatedAt
    ? formatMelbourneTime(summary.lastUpdatedAt)
    : null;
  const href = `/tank-levels?date=${encodeURIComponent(summary.date)}`;

  return (
    <Card className={cn(className)}>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-xl text-brand-navy">
              Tank levels
            </CardTitle>
            <CardDescription className="mt-1">
              {summary.totalActive === 0
                ? "No active tanks configured yet."
                : `${summary.loggedCount} of ${summary.totalActive} tanks logged for ${dayLabel}`}
              {summary.missingCount > 0
                ? ` · ${summary.missingCount} still blank`
                : null}
              {lastTime ? ` · last reading ${lastTime}` : null}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to={href}>Open day log</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {summary.totalActive > 0 ? (
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                summary.complete ? "bg-brand" : "bg-brand/60",
              )}
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (summary.loggedCount / summary.totalActive) * 100,
                  ),
                )}%`,
              }}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Admins can seed the roster from Tank levels → Manage tanks.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
