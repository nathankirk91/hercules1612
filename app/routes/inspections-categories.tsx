import { data, Form, Link } from "react-router";

import type { Route } from "./+types/inspections-categories";

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
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import {
  createInspectionCategory,
  deleteInspectionCategory,
  ensureInspectionCategories,
  listInspectionCategories,
  updateInspectionCategory,
} from "~/lib/inspection-categories.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Inspection categories") },
    {
      name: "description",
      content: "Define categories used when creating plant inspections.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);
  await ensureInspectionCategories();
  const [categories, pendingCount] = await Promise.all([
    listInspectionCategories({ includeInactive: true }),
    countPendingRuns(),
  ]);
  return { user, categories, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireOperatorManager(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    if (intent === "add") {
      await createInspectionCategory({
        name: String(formData.get("name") ?? ""),
      });
      return { ok: true as const, message: "Category created." };
    }

    if (intent === "update") {
      await updateInspectionCategory({
        categoryId: String(formData.get("categoryId") ?? ""),
        name: String(formData.get("name") ?? ""),
        isActive: formData.get("isActive") === "on",
      });
      return { ok: true as const, message: "Category updated." };
    }

    if (intent === "delete") {
      await deleteInspectionCategory(String(formData.get("categoryId") ?? ""));
      return { ok: true as const, message: "Category deleted." };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update categories.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function InspectionsCategoriesPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, categories, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Link
              to="/inspections/manage"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Manage inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            Inspection categories
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Define the categories available when creating plant inspections.
            Work permits keep their own Permits category under Permits → Manage.
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          {actionData && "ok" in actionData && actionData.ok ? (
            <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400">
              {actionData.message}
            </p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Add category</CardTitle>
              <CardDescription>
                Names appear in the category dropdown on the create and edit
                inspection forms.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <input type="hidden" name="intent" value="add" />
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="e.g. Equipment"
                    autoComplete="off"
                  />
                </div>
                <Button type="submit">Add category</Button>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Categories ({categories.length})</CardTitle>
              <CardDescription>
                Rename, hide, or remove unused categories. Renaming updates
                inspections that already use that name.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No categories yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {categories.map((category) => (
                    <li
                      key={category.id}
                      className="rounded-lg border border-border/70 bg-background/50 px-3 py-3"
                    >
                      <Form
                        method="post"
                        className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
                      >
                        <input type="hidden" name="intent" value="update" />
                        <input
                          type="hidden"
                          name="categoryId"
                          value={category.id}
                        />
                        <div className="grid gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Label htmlFor={`name-${category.id}`}>Name</Label>
                            {!category.isActive ? (
                              <Badge variant="outline">Hidden</Badge>
                            ) : null}
                          </div>
                          <Input
                            id={`name-${category.id}`}
                            name="name"
                            required
                            defaultValue={category.name}
                            autoComplete="off"
                          />
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              name="isActive"
                              defaultChecked={category.isActive}
                              className="size-4 accent-[var(--brand-navy)]"
                            />
                            Show in create/edit dropdown
                          </label>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm">
                            Save
                          </Button>
                          <Button
                            type="submit"
                            name="intent"
                            value="delete"
                            variant="outline"
                            size="sm"
                          >
                            Delete
                          </Button>
                        </div>
                      </Form>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
