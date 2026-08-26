import { data, Form, Link, redirect } from "react-router";

import type { Route } from "./+types/inspections-manage";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import {
  ensureInspectionCategories,
  listInspectionCategories,
} from "~/lib/inspection-categories.server";
import {
  createManagedInspection,
  listManagedInspections,
  seedDefaultInspections,
  setInspectionAvailability,
} from "~/lib/inspections.server";
import { isPermitInspection } from "~/lib/inspections";
import { ensureInspectionSchema } from "~/lib/migrate.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Manage inspections") },
    {
      name: "description",
      content: "Create and manage plant inspection checklists and questions.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);

  let migrateNote: string | null = null;
  let inspections = await listManagedInspections();

  // First visit after deploy: create missing tables, then seed defaults.
  // Do not run schema ensure on every navigation — that is ~24 DDL round-trips.
  if (inspections.length === 0) {
    try {
      await ensureInspectionSchema();
      const seeded = await seedDefaultInspections();
      migrateNote = `Loaded ${seeded} default inspections.`;
      inspections = await listManagedInspections();
    } catch (error) {
      migrateNote =
        error instanceof Error
          ? error.message
          : "Could not create inspection tables.";
    }
  } else if (
    !inspections.some((inspection) => inspection.fixedEquipmentRef)
  ) {
    // Upgrade path: split the combined forklift form into per-unit forms.
    try {
      const seeded = await seedDefaultInspections();
      migrateNote = `Updated default inspections (${seeded}), including per-unit forklift forms.`;
      inspections = await listManagedInspections();
    } catch (error) {
      migrateNote =
        error instanceof Error
          ? error.message
          : "Could not update forklift unit forms.";
    }
  }

  await ensureInspectionCategories();
  const [categories, pendingCount] = await Promise.all([
    listInspectionCategories(),
    countPendingRuns(),
  ]);

  const plantInspections = inspections.filter(
    (inspection) => !isPermitInspection(inspection),
  );
  const deriveSources = plantInspections.filter(
    (inspection) => !inspection.templateInspectionId,
  );

  return {
    user,
    inspections: plantInspections,
    deriveSources,
    categories,
    pendingCount,
    migrateNote,
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "seed-defaults") {
      await ensureInspectionSchema();
      const seeded = await seedDefaultInspections();
      return { ok: true as const, seeded };
    }

    if (intent === "create") {
      const category = String(formData.get("category") ?? "");
      if (category.trim().toLowerCase() === "permits") {
        return data(
          {
            error:
              "Create permit forms under Permits → Manage, not Inspections.",
          },
          { status: 400 },
        );
      }
      const isMasterTemplate =
        String(formData.get("isMasterTemplate") ?? "") === "on";
      const templateInspectionId =
        String(formData.get("templateInspectionId") ?? "").trim() || null;

      const created = await createManagedInspection({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category,
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
        isMasterTemplate,
        templateInspectionId,
        fixedEquipmentRef: String(formData.get("fixedEquipmentRef") ?? ""),
      });
      throw redirect(`/inspections/manage/${created.id}`);
    }

    if (intent === "toggle") {
      const inspectionId = String(formData.get("inspectionId") ?? "");
      const isAvailable = String(formData.get("isAvailable") ?? "") === "true";
      if (!inspectionId) {
        return data({ error: "Missing inspection." }, { status: 400 });
      }
      await setInspectionAvailability(inspectionId, !isAvailable);
      return { ok: true as const };
    }
  } catch (error) {
    if (error instanceof Response) {
      throw error;
    }
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update inspections.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function InspectionsManagePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const {
    user,
    inspections,
    deriveSources,
    categories,
    pendingCount,
    migrateNote,
  } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/inspections"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Inspections
            </Link>
            <Link
              to="/inspections/categories"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              Categories
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Manage inspections
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Create master templates or standalone checklists, then derive unit
            or variant forms from a master. Work permits are managed separately
            under{" "}
            <Link
              to="/permits/manage"
              className="underline-offset-4 hover:underline"
            >
              Permits → Manage
            </Link>
            .
          </p>
          {migrateNote ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {migrateNote}
            </p>
          ) : null}
          {actionData && "seeded" in actionData && actionData.seeded != null ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              Loaded {actionData.seeded} default inspections (forklift template +
              unit forms, start-up, shut-down). Edit shared forklift questions on
              the master template.
            </p>
          ) : null}
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle>Add inspection</CardTitle>
              <CardDescription>
                Create a master template to share questions across derived
                forms, or a standalone checklist. Categories are managed under{" "}
                <Link
                  to="/inspections/categories"
                  className="underline-offset-4 hover:underline"
                >
                  Categories
                </Link>
                .
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="create" />
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    placeholder="e.g. Boiler room weekly check"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    placeholder="Short explanation shown on the catalog page"
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="category">Category</Label>
                    <select
                      id="category"
                      name="category"
                      required
                      className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      defaultValue={categories[0]?.name ?? "General"}
                    >
                      {categories.length === 0 ? (
                        <option value="General">General</option>
                      ) : (
                        categories.map((category) => (
                          <option key={category.id} value={category.name}>
                            {category.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equipmentLabel">
                      Equipment ID label (optional)
                    </Label>
                    <Input
                      id="equipmentLabel"
                      name="equipmentLabel"
                      placeholder="e.g. Forklift / unit ID"
                      autoComplete="off"
                    />
                  </div>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isMasterTemplate"
                    className="mt-0.5 size-4 accent-[var(--brand-navy)]"
                  />
                  <span>
                    Master template
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      Owns the shared question list. Hidden from operators by
                      default; create derived forms that inherit its questions.
                    </span>
                  </span>
                </label>
                <div className="grid gap-2">
                  <Label htmlFor="templateInspectionId">
                    Derive from master (optional)
                  </Label>
                  <select
                    id="templateInspectionId"
                    name="templateInspectionId"
                    className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    defaultValue=""
                  >
                    <option value="">None — standalone or new master</option>
                    {deriveSources.map((source) => (
                      <option key={source.id} value={source.id}>
                        {source.title}
                        {source.isMasterTemplate ? " (master)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    Derived forms inherit questions from the selected checklist.
                    Leave blank when creating a standalone form or a new master.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fixedEquipmentRef">
                    Unit / equipment ID (optional, for derived forms)
                  </Label>
                  <Input
                    id="fixedEquipmentRef"
                    name="fixedEquipmentRef"
                    placeholder="e.g. H57168"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <Button type="submit">Create inspection</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-75">
            <CardHeader>
              <CardTitle>All inspections</CardTitle>
              <CardDescription>
                Edit questions, or hide an inspection from the Inspections page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspections.length === 0 ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">
                    No inspections in the database yet. Load the built-in
                    forklift, daily start-up, and daily shut-down checklists to
                    edit them.
                  </p>
                  <Form method="post">
                    <input type="hidden" name="intent" value="seed-defaults" />
                    <Button type="submit">Load default inspections</Button>
                  </Form>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {inspections.map((inspection) => (
                    <li
                      key={inspection.id}
                      className="flex flex-col gap-3 rounded-lg border border-border/70 bg-background/50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-brand-navy">
                            {inspection.title}
                          </p>
                          <Badge variant="secondary">{inspection.category}</Badge>
                          <Badge variant="outline">v{inspection.version}</Badge>
                          {inspection.isMasterTemplate ? (
                            <Badge variant="outline">Master template</Badge>
                          ) : null}
                          {inspection.templateInspectionId ? (
                            <Badge variant="outline">Derived</Badge>
                          ) : null}
                          {inspection.fixedEquipmentRef ? (
                            <Badge variant="outline">
                              {inspection.fixedEquipmentRef}
                            </Badge>
                          ) : null}
                          {!inspection.isAvailable ? (
                            <Badge variant="outline">Hidden</Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {inspection.questionCount} question
                          {inspection.questionCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/inspections/manage/${inspection.id}`}>
                            Edit questions
                          </Link>
                        </Button>
                        <Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input
                            type="hidden"
                            name="inspectionId"
                            value={inspection.id}
                          />
                          <input
                            type="hidden"
                            name="isAvailable"
                            value={String(inspection.isAvailable)}
                          />
                          <Button type="submit" variant="ghost" size="sm">
                            {inspection.isAvailable ? "Hide" : "Show"}
                          </Button>
                        </Form>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {inspections.length > 0 ? (
                <Form method="post" className="mt-4">
                  <input type="hidden" name="intent" value="seed-defaults" />
                  <Button type="submit" variant="outline" size="sm">
                    Re-sync built-in defaults
                  </Button>
                </Form>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
