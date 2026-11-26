import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { formatMelbourneDateTime } from "~/lib/datetime";
import type { InspectionSectionReportView } from "~/lib/inspection-section-report";
import {
  formatLastAnswerDisplay,
  type InspectionQuestionType,
} from "~/lib/inspections";
import { cn } from "~/lib/utils";

type Props = {
  report: InspectionSectionReportView;
};

export function InspectionSectionReport({ report }: Props) {
  const completedAt = report.completedAt
    ? formatMelbourneDateTime(report.completedAt)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Section report</CardTitle>
        <CardDescription>
          View only — this section was already saved and cannot be edited.
          {report.completedByName
            ? ` Completed by ${report.completedByName}`
            : ""}
          {completedAt ? ` · ${completedAt}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {report.answers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No answers were saved for this section.
          </p>
        ) : (
          <ul className="grid gap-2">
            {report.answers.map((row) => (
              <li
                key={row.questionId}
                className="flex flex-wrap items-start justify-between gap-2 text-sm"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <AnswerBadge
                  answer={row.answer}
                  flagged={row.flagged}
                  type={row.type}
                />
              </li>
            ))}
          </ul>
        )}

        {report.notes ? (
          <div className="border-t border-border/60 pt-3">
            <p className="text-sm font-medium">Notes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {report.notes}
            </p>
          </div>
        ) : null}

        {report.signature ? (
          <div className="border-t border-border/60 pt-3">
            <p className="text-sm font-medium">
              {report.sectionTitle
                ? `${report.sectionTitle} signature`
                : "Signature"}
            </p>
            <div className="mt-2">
              <img
                src={report.signature}
                alt={
                  report.sectionTitle
                    ? `${report.sectionTitle} signature`
                    : "Signature"
                }
                className="h-20 w-auto rounded border border-border/50 bg-white object-contain sm:h-28"
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AnswerBadge({
  answer,
  flagged,
  type,
}: {
  answer: string;
  flagged: boolean;
  type: InspectionQuestionType;
}) {
  const display = answer ? formatLastAnswerDisplay(answer, type) : "—";
  return (
    <Badge
      variant="outline"
      className={cn(
        "max-w-full shrink-0 whitespace-normal text-left",
        flagged
          ? "border-amber-600/40 text-amber-800"
          : "border-emerald-600/40 text-emerald-700",
      )}
    >
      {display}
    </Badge>
  );
}
