import { data, Form, Link } from "react-router";
import { parseWithZod } from "@conform-to/zod/v4";

import type { Route } from "./+types/tank-levels-manage";

import { pageTitle } from "~/lib/brand";
import { AppHeader } from "~/components/app-header";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
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
import { requireAdmin } from "~/lib/auth.server";
import { tankUpsertSchema } from "~/lib/tank-levels.schema";
import {
  createTank,
  listTanks,
  seedDefaultTanks,
  updateTank,
} from "~/lib/tank-levels.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Manage tanks") },
    {
      name: "description",
      content: "Add and edit bulk tank roster and capacities.",
    },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request, "/tank-levels/manage");
  const [tanks, pendingCount] = await Promise.all([
    listTanks(),
    countPendingRuns(),
  ]);
  return { user, tanks, pendingCount };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request, "/tank-levels/manage");
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "seed-defaults") {
    const seeded = await seedDefaultTanks();
    return {
      ok: true as const,
      message: `Synced ${seeded} tanks from the seed roster.`,
    };
  }

  if (intent === "create" || intent === "update") {
    const submission = parseWithZod(formData, { schema: tankUpsertSchema });
    if (submission.status !== "success") {
      return data(
        {
          ok: false as const,
          error: "Check the tank details and try again.",
          fieldErrors: submission.error,
        },
        { status: 400 },
      );
    }

    const value = submission.value;
    try {
      if (intent === "create") {
        await createTank({
          code: value.code,
          product: value.product,
          capacityKg: value.capacityKg,
          sortOrder: value.sortOrder,
          isActive: value.isActive ?? true,
        });
        return { ok: true as const, message: `Added tank ${value.code}.` };
      }

      if (!value.tankId) {
        return data(
          { ok: false as const, error: "Missing tank id." },
          { status: 400 },
        );
      }

      await updateTank({
        tankId: value.tankId,
        code: value.code,
        product: value.product,
        capacityKg: value.capacityKg,
        sortOrder: value.sortOrder,
        isActive: value.isActive ?? false,
      });
      return { ok: true as const, message: `Updated tank ${value.code}.` };
    } catch (error) {
      return data(
        {
          ok: false as const,
          error:
            error instanceof Error ? error.message : "Could not save tank.",
        },
        { status: 400 },
      );
    }
  }

  return data({ ok: false as const, error: "Unknown action." }, { status: 400 });
}

export default function TankLevelsManagePage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, tanks, pendingCount } = loaderData;

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="app-main">
        <section className="mb-8 max-w-2xl">
          <p className="mb-2 text-sm">
            <Link
              to="/tank-levels"
              className="text-muted-foreground underline-offset-4 hover:underline"
            >
              ← Tank levels
            </Link>
          </p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
            Manage tanks
          </h1>
          <p className="mt-2 text-muted-foreground">
            Roster codes, products, and capacities (kg). Inactive tanks are
            hidden from the day log.
          </p>
        </section>

        {actionData && "message" in actionData && actionData.message ? (
          <Alert className="mb-6">
            <AlertTitle>Done</AlertTitle>
            <AlertDescription>{actionData.message}</AlertDescription>
          </Alert>
        ) : null}
        {actionData && "error" in actionData && actionData.error ? (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>Could not save</AlertTitle>
            <AlertDescription>{actionData.error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Add tank</CardTitle>
              <CardDescription>
                Codes are stored without trailing *. Sync seed to load the
                plant roster.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="create" />
                <div className="grid gap-1.5">
                  <Label htmlFor="new-code">Code</Label>
                  <Input id="new-code" name="code" required className="h-11" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-product">Product</Label>
                  <Input
                    id="new-product"
                    name="product"
                    required
                    className="h-11"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-capacity">Capacity (kg)</Label>
                  <Input
                    id="new-capacity"
                    name="capacityKg"
                    type="number"
                    min={1}
                    step={1}
                    required
                    className="h-11"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="new-sort">Sort order</Label>
                  <Input
                    id="new-sort"
                    name="sortOrder"
                    type="number"
                    step={1}
                    defaultValue={0}
                    className="h-11"
                  />
                </div>
                <label className="flex min-h-11 items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="on"
                    defaultChecked
                    className="size-5 rounded border"
                  />
                  Active
                </label>
                <Button type="submit" size="lg" className="min-h-11 w-full">
                  Add tank
                </Button>
              </Form>

              <Form method="post">
                <input type="hidden" name="intent" value="seed-defaults" />
                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  className="min-h-11 w-full"
                >
                  Sync seed roster
                </Button>
              </Form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Roster</CardTitle>
              <CardDescription>
                {tanks.length} tank{tanks.length === 1 ? "" : "s"}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              {tanks.map((tank) => (
                <Form
                  key={tank.id}
                  method="post"
                  className="grid gap-3 rounded-lg border p-4"
                >
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="tankId" value={tank.id} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-brand-navy">{tank.code}</p>
                    {tank.isActive ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`code-${tank.id}`}>Code</Label>
                      <Input
                        id={`code-${tank.id}`}
                        name="code"
                        defaultValue={tank.code}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`product-${tank.id}`}>Product</Label>
                      <Input
                        id={`product-${tank.id}`}
                        name="product"
                        defaultValue={tank.product}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`capacity-${tank.id}`}>
                        Capacity (kg)
                      </Label>
                      <Input
                        id={`capacity-${tank.id}`}
                        name="capacityKg"
                        type="number"
                        min={1}
                        step={1}
                        defaultValue={tank.capacityKg}
                        required
                        className="h-11"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`sort-${tank.id}`}>Sort order</Label>
                      <Input
                        id={`sort-${tank.id}`}
                        name="sortOrder"
                        type="number"
                        step={1}
                        defaultValue={tank.sortOrder}
                        className="h-11"
                      />
                    </div>
                  </div>
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="checkbox"
                      name="isActive"
                      value="on"
                      defaultChecked={tank.isActive}
                      className="size-5 rounded border"
                    />
                    Active
                  </label>
                  <Button
                    type="submit"
                    variant="outline"
                    size="lg"
                    className="min-h-11 w-full sm:w-auto"
                  >
                    Save {tank.code}
                  </Button>
                </Form>
              ))}
              {tanks.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No tanks yet. Sync the seed roster or add one manually.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
