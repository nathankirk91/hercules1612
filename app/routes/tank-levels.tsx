import { data } from "react-router";
import { parseWithZod } from "@conform-to/zod/v4";

import type { Route } from "./+types/tank-levels";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { TankLevelsDayForm } from "~/components/tank-levels-day-form";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireUser } from "~/lib/auth.server";
import {
  formatMelbourneYmd,
  melbourneDateYmd,
  parseYmd,
} from "~/lib/datetime";
import { canReviewRuns } from "~/lib/roles";
import {
  canEditTankLevelsForDay,
  canManageTanks,
  overCapacityWarning,
} from "~/lib/tank-levels";
import { tankDaySaveSchema } from "~/lib/tank-levels.schema";
import {
  getTankDaySummary,
  listTankDayRows,
  saveTankDayLevels,
  seedDefaultTanks,
} from "~/lib/tank-levels.server";
import { redirectWithToast } from "~/lib/toast.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Tank levels") },
    {
      name: "description",
      content: "Log daily bulk tank levels in kilograms.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request, "/tank-levels");
  const url = new URL(request.url);
  const day = parseYmd(url.searchParams.get("date")) ?? melbourneDateYmd();
  const today = melbourneDateYmd();

  // First visit: ensure roster exists so the day grid is useful immediately.
  const summaryBefore = await getTankDaySummary(day);
  if (summaryBefore.totalActive === 0) {
    await seedDefaultTanks();
  }

  const [rows, summary, pendingCount] = await Promise.all([
    listTankDayRows(day),
    getTankDaySummary(day),
    canReviewRuns(user.role) ? countPendingRuns() : Promise.resolve(0),
  ]);

  return {
    user,
    day,
    today,
    rows,
    summary,
    pendingCount,
    canEdit: canEditTankLevelsForDay(user.role, day, today),
    canManage: canManageTanks(user.role),
  };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request, "/tank-levels");
  const formData = await request.formData();
  const submission = parseWithZod(formData, { schema: tankDaySaveSchema });

  if (submission.status !== "success") {
    return data(
      { result: submission.reply(), formError: null, message: null, warnings: {} },
      { status: 400 },
    );
  }

  const today = melbourneDateYmd();
  const { day, entries } = submission.value;

  if (!canEditTankLevelsForDay(user.role, day, today)) {
    return data(
      {
        result: submission.reply({
          formErrors: ["Only admins can edit previous days."],
        }),
        formError: "Only admins can edit previous days.",
        message: null,
        warnings: {},
      },
      { status: 403 },
    );
  }

  const rows = await listTankDayRows(day);
  const capacityById = new Map(rows.map((row) => [row.id, row.capacityKg]));
  const warnings: Record<string, string> = {};
  for (const entry of entries) {
    const capacity = capacityById.get(entry.tankId);
    if (capacity == null) {
      continue;
    }
    const warn = overCapacityWarning(entry.levelKg, capacity);
    if (warn) {
      warnings[entry.tankId] = warn;
    }
  }

  let saved = 0;
  try {
    ({ saved } = await saveTankDayLevels({
      day,
      entries,
      recordedById: user.id,
    }));
  } catch (error) {
    return data(
      {
        result: submission.reply({
          formErrors: [
            error instanceof Error ? error.message : "Could not save levels.",
          ],
        }),
        formError:
          error instanceof Error ? error.message : "Could not save levels.",
        message: null,
        warnings,
      },
      { status: 400 },
    );
  }

  if (saved === 0) {
    return {
      result: submission.reply(),
      formError: null,
      message: "Nothing to save — enter at least one level.",
      warnings,
    };
  }

  // Redirect so the loader remounts with persisted values (uncontrolled
  // inputs only pick up new defaultValue after a fresh navigation).
  return redirectWithToast(`/tank-levels?date=${encodeURIComponent(day)}`, {
    type: "success",
    title: "Tank levels saved",
    description: `Saved ${saved} tank level${saved === 1 ? "" : "s"}.`,
  });
}

export default function TankLevelsPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, day, rows, summary, pendingCount, canEdit, canManage } =
    loaderData;
  const dayLabel = formatMelbourneYmd(day) ?? day;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="app-main">
        <section className="mb-6 max-w-2xl sm:mb-8">
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
            Tank levels
          </h1>
          <p className="mt-2 text-muted-foreground">
            Daily bulk tank readings for {dayLabel}. Leave tanks blank if not
            measured yet — you can finish the day later.
          </p>
        </section>

        <TankLevelsDayForm
          day={day}
          rows={rows}
          canEdit={canEdit}
          canManage={canManage}
          loggedCount={summary.loggedCount}
          lastResult={actionData?.result}
          formError={actionData?.formError}
          message={actionData?.message}
          warnings={actionData?.warnings}
        />
      </main>
    </div>
  );
}
