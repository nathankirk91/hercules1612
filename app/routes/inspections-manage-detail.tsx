import { data, Form, Link, redirect } from "react-router";
import { useCallback, useState } from "react";

import type { Route } from "./+types/inspections-manage-detail";

import {
  ChecklistQuestionEditor,
  ChecklistQuestionFields,
} from "~/components/checklist-question-editor";
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
import {
  useManageAddFeedback,
  shouldShowInlineManageMessage,
} from "~/hooks/use-manage-add-feedback";
import { countPendingRuns } from "~/lib/approvals.server";
import { requireOperatorManager } from "~/lib/auth.server";
import { dataWithToast } from "~/lib/toast.server";
import {
  isPermitInspection,
  parseChecklistQuestionFormData,
  questionTypeLabel,
  type InspectionQuestionType,
  type InspectionSectionDef,
} from "~/lib/inspections";
import {
  addInspectionQuestion,
  addInspectionSection,
  createManagedInspection,
  getManagedInspection,
  moveInspectionQuestion,
  moveInspectionSection,
  publishInspectionVersion,
  removeInspectionQuestion,
  removeInspectionSection,
  updateInspectionQuestion,
  updateInspectionSection,
  updateManagedInspection,
  type InspectionVersionHistoryItem,
} from "~/lib/inspections.server";
import {
  ensureInspectionCategories,
  listInspectionCategories,
} from "~/lib/inspection-categories.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: pageTitle("Edit inspection") },
    {
      name: "description",
      content: "Edit inspection details and checklist questions.",
    },
  ];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const user = await requireOperatorManager(request);
  const inspection = await getManagedInspection(params.inspectionId);
  if (!inspection) {
    throw new Response("Inspection not found", { status: 404 });
  }
  if (isPermitInspection(inspection)) {
    throw redirect(`/permits/manage/${inspection.id}`);
  }
  await ensureInspectionCategories();
  const [categories, pendingCount] = await Promise.all([
    listInspectionCategories(),
    countPendingRuns(),
  ]);
  return { user, inspection, categories, pendingCount };
}

export async function action({ request, params }: Route.ActionArgs) {
  const user = await requireOperatorManager(request);
  const inspectionId = params.inspectionId;
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  try {
    const existing = await getManagedInspection(inspectionId);
    if (!existing) {
      return data({ error: "Inspection not found." }, { status: 404 });
    }
    if (isPermitInspection(existing)) {
      return data(
        { error: "Edit this form under Permits → Manage." },
        { status: 400 },
      );
    }

    if (intent === "update") {
      const nextCategory = String(formData.get("category") ?? "");
      if (nextCategory.trim().toLowerCase() === "permits") {
        return data(
          {
            error:
              "Move forms to Permits → Manage instead of changing category here.",
          },
          { status: 400 },
        );
      }
      await updateManagedInspection({
        id: inspectionId,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: nextCategory,
        equipmentLabel: String(formData.get("equipmentLabel") ?? ""),
        isAvailable: String(formData.get("isAvailable") ?? "") === "on",
        requiredSignerCount: null,
        isMasterTemplate:
          existing.inheritsQuestions
            ? false
            : String(formData.get("isMasterTemplate") ?? "") === "on",
        workflowMode: String(formData.get("workflowMode") ?? ""),
        dayRecordPolicy: String(formData.get("dayRecordPolicy") ?? ""),
        sectionOrder: String(formData.get("sectionOrder") ?? ""),
      });
      return { ok: true as const, message: "Details saved." };
    }

    if (intent === "add-derived") {
      if (existing.inheritsQuestions) {
        return data(
          {
            error:
              "Derived forms are added from the master template, not from another derived form.",
          },
          { status: 400 },
        );
      }
      const created = await createManagedInspection({
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        category: existing.category,
        equipmentLabel: existing.equipmentLabel ?? "",
        templateInspectionId: inspectionId,
        fixedEquipmentRef: String(formData.get("fixedEquipmentRef") ?? ""),
        isAvailable: true,
      });
      throw redirect(`/inspections/manage/${created.id}`);
    }

    if (intent === "publish-version") {
      const version = await publishInspectionVersion({
        inspectionId,
        changeComment: String(formData.get("changeComment") ?? ""),
        changedById: user.id,
      });
      return {
        ok: true as const,
        message: `Checklist published as revision ${version}.`,
      };
    }

    if (intent === "add-question" || intent === "update-question") {
      const parsed = parseChecklistQuestionFormData(formData, "inspection");
      if ("error" in parsed) {
        return data({ error: parsed.error }, { status: 400 });
      }

      if (intent === "add-question") {
        await addInspectionQuestion({
          inspectionId,
          ...parsed,
        });
        return dataWithToast(
          {
            ok: true as const,
            intent: "add-question" as const,
          },
          {
            description: "Question added",
            type: "success",
          },
        );
      }

      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await updateInspectionQuestion({
        questionId,
        ...parsed,
      });
      return {
        ok: true as const,
        message:
          "Question updated. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "remove-question") {
      const questionId = String(formData.get("questionId") ?? "");
      if (!questionId) {
        return data({ error: "Missing question." }, { status: 400 });
      }
      await removeInspectionQuestion({
        questionId,
      });
      return {
        ok: true as const,
        message:
          "Question removed. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "move-question") {
      const questionId = String(formData.get("questionId") ?? "");
      const direction = String(formData.get("direction") ?? "");
      if (!questionId || (direction !== "up" && direction !== "down")) {
        return data({ error: "Invalid move request." }, { status: 400 });
      }
      await moveInspectionQuestion({
        questionId,
        direction,
      });
      return {
        ok: true as const,
        message:
          "Question order updated. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "add-section") {
      await addInspectionSection({
        inspectionId,
        title: String(formData.get("title") ?? ""),
        requiresSignature:
          String(formData.get("requiresSignature") ?? "") === "on",
      });
      return dataWithToast(
        {
          ok: true as const,
          intent: "add-section" as const,
        },
        {
          description: "Section added",
          type: "success",
        },
      );
    }

    if (intent === "update-section") {
      const sectionId = String(formData.get("sectionId") ?? "");
      if (!sectionId) {
        return data({ error: "Missing section." }, { status: 400 });
      }
      await updateInspectionSection({
        sectionId,
        title: String(formData.get("title") ?? ""),
        requiresSignature:
          String(formData.get("requiresSignature") ?? "") === "on",
        skipWhenQuestionId: String(formData.get("skipWhenQuestionId") ?? ""),
        skipWhenEquals: String(formData.get("skipWhenEquals") ?? ""),
      });
      return {
        ok: true as const,
        message:
          "Section updated. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "remove-section") {
      const sectionId = String(formData.get("sectionId") ?? "");
      if (!sectionId) {
        return data({ error: "Missing section." }, { status: 400 });
      }
      await removeInspectionSection({ sectionId });
      return {
        ok: true as const,
        message:
          "Section removed. Publish a revision when your checklist edits are ready.",
      };
    }

    if (intent === "move-section") {
      const sectionId = String(formData.get("sectionId") ?? "");
      const direction = String(formData.get("direction") ?? "");
      if (!sectionId || (direction !== "up" && direction !== "down")) {
        return data({ error: "Invalid move request." }, { status: 400 });
      }
      await moveInspectionSection({ sectionId, direction });
      return {
        ok: true as const,
        message:
          "Section order updated. Publish a revision when your checklist edits are ready.",
      };
    }
  } catch (error) {
    return data(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update this inspection.",
      },
      { status: 400 },
    );
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

function SectionEditor({
  section,
  questions,
  index,
  total,
  isEditing,
  onEdit,
  onCancel,
}: {
  section: InspectionSectionDef;
  questions: Array<{ id: string; label: string; sectionId?: string | null }>;
  index: number;
  total: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  if (isEditing) {
    return (
      <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-3">
        <Form method="post" className="grid gap-4" onSubmit={onCancel}>
          <input type="hidden" name="intent" value="update-section" />
          <input type="hidden" name="sectionId" value={section.id} />
          <p className="text-sm font-medium text-brand-navy">Edit section</p>
          <div className="grid gap-2">
            <Label htmlFor={`section-title-${section.id}`}>Section title</Label>
            <Input
              id={`section-title-${section.id}`}
              name="title"
              required
              defaultValue={section.title}
              autoComplete="off"
            />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="requiresSignature"
              defaultChecked={section.requiresSignature}
              className="mt-0.5 size-4 accent-[var(--brand-navy)]"
            />
            <span>
              Requires signature at end of section
              <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                When checked, operators must sign or initial after completing
                this section.
              </span>
            </span>
          </label>
          <div className="grid gap-2">
            <Label htmlFor={`skip-question-${section.id}`}>
              Skip this section when
            </Label>
            <select
              id={`skip-question-${section.id}`}
              name="skipWhenQuestionId"
              className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              defaultValue={section.skipWhenQuestionId ?? ""}
            >
              <option value="">Never skip</option>
              {questions
                .filter((question) => question.sectionId !== section.id)
                .map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.label}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`skip-equals-${section.id}`}>
              Answer equals
            </Label>
            <Input
              id={`skip-equals-${section.id}`}
              name="skipWhenEquals"
              defaultValue={section.skipWhenEquals ?? ""}
              placeholder="e.g. Yes"
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              If that question is answered with this value, this section is
              marked not required.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Save section</Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </Form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border/70 bg-background/50 px-3 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">#{index + 1}</span>
            <p className="font-medium text-brand-navy">{section.title}</p>
            {section.requiresSignature ? (
              <Badge variant="secondary">Signature required</Badge>
            ) : (
              <Badge variant="outline">No signature</Badge>
            )}
            {section.skipWhenQuestionId ? (
              <Badge variant="outline">Can skip</Badge>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Form method="post">
            <input type="hidden" name="intent" value="move-section" />
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="direction" value="up" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={index === 0}
            >
              Move up
            </Button>
          </Form>
          <Form method="post">
            <input type="hidden" name="intent" value="move-section" />
            <input type="hidden" name="sectionId" value={section.id} />
            <input type="hidden" name="direction" value="down" />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={index >= total - 1}
            >
              Move down
            </Button>
          </Form>
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Form method="post">
            <input type="hidden" name="intent" value="remove-section" />
            <input type="hidden" name="sectionId" value={section.id} />
            <Button type="submit" variant="outline" size="sm">
              Remove
            </Button>
          </Form>
        </div>
      </div>
    </li>
  );
}

function formatVersionDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function VersionHistory({
  versions,
}: {
  versions: InspectionVersionHistoryItem[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (versions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No version history yet.</p>
    );
  }

  return (
    <ul className="grid gap-3">
      {versions.map((version) => {
        const expanded = expandedId === version.id;
        const author =
          version.changedByName || version.changedByEmail || "System";
        return (
          <li
            key={version.id}
            className="rounded-lg border border-border/70 bg-background/50 px-3 py-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">v{version.version}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {formatVersionDate(version.createdAt)}
                  </span>
                  <span className="text-sm text-muted-foreground">· {author}</span>
                </div>
                <p className="mt-2 text-sm text-brand-navy">
                  {version.changeComment}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {version.questionCount} question
                  {version.questionCount === 1 ? "" : "s"} in this snapshot
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setExpandedId(expanded ? null : version.id)
                }
              >
                {expanded ? "Hide questions" : "Show questions"}
              </Button>
            </div>
            {expanded ? (
              <ol className="mt-3 grid gap-2 border-t border-border/60 pt-3">
                {version.snapshot.questions.map((question, index) => (
                  <li
                    key={`${version.id}-${question.id || index}`}
                    className="text-sm"
                  >
                    <span className="text-muted-foreground">#{index + 1}</span>{" "}
                    {question.label}
                    <span className="text-muted-foreground">
                      {" "}
                      ({questionTypeLabel(question.type)})
                    </span>
                  </li>
                ))}
              </ol>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export default function InspectionsManageDetailPage({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { user, inspection, categories, pendingCount } = loaderData;
  const [questionType, setQuestionType] =
    useState<InspectionQuestionType>("YES_NO");
  const [radioOptions, setRadioOptions] = useState("OK\nNeeds attention\nN/A");
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(
    null,
  );
  const [editingSectionId, setEditingSectionId] = useState<string | null>(
    null,
  );
  const [sectionFormKey, setSectionFormKey] = useState(0);
  const [questionFormKey, setQuestionFormKey] = useState(0);
  const sections = inspection.sections ?? [];

  const resetSectionForm = useCallback(() => {
    setSectionFormKey((key) => key + 1);
  }, []);

  const resetQuestionForm = useCallback(() => {
    setQuestionFormKey((key) => key + 1);
    setQuestionType("YES_NO");
    setRadioOptions("OK\nNeeds attention\nN/A");
  }, []);

  useManageAddFeedback(actionData, {
    onAddSection: resetSectionForm,
    onAddQuestion: resetQuestionForm,
  });

  return (
    <div className="app-shell">
      <AppHeader user={user} pendingCount={pendingCount} />
      <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Management</Badge>
            <Badge variant="outline">Version {inspection.version}</Badge>
            {inspection.hasUnpublishedChanges ? (
              <Badge variant="outline">Unpublished changes</Badge>
            ) : null}
            {inspection.isMasterTemplate || inspection.unitFormCount > 0 ? (
              <Badge variant="outline">
                Master template
                {inspection.unitFormCount > 0
                  ? ` · ${inspection.unitFormCount} derived`
                  : ""}
              </Badge>
            ) : null}
            {inspection.inheritsQuestions ? (
              <Badge variant="outline">Derived · shared questions</Badge>
            ) : null}
            {inspection.fixedEquipmentRef ? (
              <Badge variant="outline">
                Unit {inspection.fixedEquipmentRef}
              </Badge>
            ) : null}
            <Link
              to="/inspections/manage"
              className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            >
              ← All inspections
            </Link>
          </div>
          <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
            {inspection.title}
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {inspection.inheritsQuestions ? (
              <>
                This form inherits its checklist from the master template.
                Change questions once on the template and every derived form
                updates. Operators fill this out on{" "}
                <Link
                  to={inspection.href}
                  className="underline-offset-4 hover:underline"
                >
                  the inspection form
                </Link>
                .
              </>
            ) : inspection.isMasterTemplate || inspection.unitFormCount > 0 ? (
              <>
                This is a master template. Question edits here apply to all{" "}
                {inspection.unitFormCount} derived form
                {inspection.unitFormCount === 1 ? "" : "s"}. Publish one
                revision when your batch of edits is done. Masters stay hidden
                from operators unless you show them.
              </>
            ) : (
              <>
                Update details and edit questions freely. Mark it as a master
                template to derive other inspections from it. When you are done,
                publish one form revision with a single comment. Operators fill
                these out on{" "}
                <Link
                  to={inspection.href}
                  className="underline-offset-4 hover:underline"
                >
                  the inspection form
                </Link>
                .
              </>
            )}
          </p>
          {actionData && "error" in actionData && actionData.error ? (
            <p className="mt-3 text-sm text-destructive">{actionData.error}</p>
          ) : null}
          {shouldShowInlineManageMessage(actionData) ? (
            <p className="mt-3 text-sm text-emerald-700">{actionData.message}</p>
          ) : null}
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Title and availability changes do not create a new revision.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form method="post" className="grid gap-4">
                <input type="hidden" name="intent" value="update" />
                <div className="grid gap-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    name="title"
                    required
                    defaultValue={inspection.title}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    rows={2}
                    defaultValue={inspection.description}
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
                      defaultValue={inspection.category}
                    >
                      {!categories.some(
                        (category) => category.name === inspection.category,
                      ) ? (
                        <option value={inspection.category}>
                          {inspection.category}
                        </option>
                      ) : null}
                      {categories.map((category) => (
                        <option key={category.id} value={category.name}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Manage categories under{" "}
                      <Link
                        to="/inspections/categories"
                        className="underline-offset-4 hover:underline"
                      >
                        Inspections → Categories
                      </Link>
                      .
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="equipmentLabel">Equipment ID label</Label>
                    <Input
                      id="equipmentLabel"
                      name="equipmentLabel"
                      defaultValue={inspection.equipmentLabel ?? ""}
                      placeholder="Leave blank if not needed"
                    />
                  </div>
                </div>
                {!inspection.inheritsQuestions ? (
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="isMasterTemplate"
                      defaultChecked={inspection.isMasterTemplate}
                      className="mt-0.5 size-4 accent-[var(--brand-navy)]"
                    />
                    <span>
                      Master template
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Other inspections can inherit this checklist. Turn off
                        only after removing derived forms.
                      </span>
                    </span>
                  </label>
                ) : null}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="isAvailable"
                    defaultChecked={inspection.isAvailable}
                    className="size-4 accent-[var(--brand-navy)]"
                  />
                  Show on Inspections page
                </label>
                {!inspection.inheritsQuestions ? (
                  <fieldset className="grid gap-3 rounded-lg border border-border/70 bg-background/50 p-4">
                    <legend className="px-1 text-sm font-medium text-brand-navy">
                      Records and sections
                    </legend>
                    <p className="text-xs text-muted-foreground">
                      Default is a single submit of the whole form. Turn on
                      records to let operators complete sections separately,
                      including across people and (optionally) Day / Afternoon.
                    </p>
                    <div className="grid gap-2">
                      <Label htmlFor="workflowMode">How operators complete this</Label>
                      <select
                        id="workflowMode"
                        name="workflowMode"
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue={inspection.workflowMode ?? "SINGLE_SUBMIT"}
                      >
                        <option value="SINGLE_SUBMIT">
                          Single submit (whole form at once)
                        </option>
                        <option value="SECTIONED">
                          Records and sections
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="dayRecordPolicy">
                        Records per calendar day
                      </Label>
                      <select
                        id="dayRecordPolicy"
                        name="dayRecordPolicy"
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue={inspection.dayRecordPolicy ?? "ONE"}
                      >
                        <option value="ONE">One record per day</option>
                        <option value="PER_SHIFT">
                          One record per shift (Day and Afternoon)
                        </option>
                      </select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sectionOrder">Section order</Label>
                      <select
                        id="sectionOrder"
                        name="sectionOrder"
                        className="flex h-9 w-full rounded-lg border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                        defaultValue={inspection.sectionOrder ?? "ANY"}
                      >
                        <option value="ANY">Any order</option>
                        <option value="STRICT">
                          Strict (list order — next section unlocks after the
                          previous is done or skipped)
                        </option>
                      </select>
                    </div>
                  </fieldset>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Record settings are inherited from the master template.
                  </p>
                )}
                <div>
                  <Button type="submit">Save details</Button>
                </div>
              </Form>
            </CardContent>
          </Card>

          {!inspection.inheritsQuestions ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  Derived inspections ({inspection.derivedForms.length})
                </CardTitle>
                <CardDescription>
                  Forms that inherit this checklist. Add a unit ID when the
                  derived form is locked to one piece of equipment.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Form method="post" className="grid gap-4 rounded-lg border border-border/70 bg-background/50 p-4">
                  <input type="hidden" name="intent" value="add-derived" />
                  <p className="text-sm font-medium text-brand-navy">
                    Add derived inspection
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="derived-title">Title</Label>
                    <Input
                      id="derived-title"
                      name="title"
                      required
                      placeholder="e.g. Forklift H57168 daily check"
                      autoComplete="off"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="derived-description">
                      Description (optional)
                    </Label>
                    <Textarea
                      id="derived-description"
                      name="description"
                      rows={2}
                      placeholder="Shown on the catalog when this form is available"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="derived-equipment">
                      Unit / equipment ID (optional)
                    </Label>
                    <Input
                      id="derived-equipment"
                      name="fixedEquipmentRef"
                      placeholder="e.g. H57168"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <Button type="submit">Add derived form</Button>
                  </div>
                </Form>

                {inspection.derivedForms.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No derived forms yet. Add one above, or create one from
                    Manage inspections with “Derive from master”.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {inspection.derivedForms.map((form) => (
                      <li
                        key={form.id}
                        className="flex flex-col gap-2 rounded-lg border border-border/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium text-brand-navy">
                            {form.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {form.fixedEquipmentRef
                              ? `Unit ${form.fixedEquipmentRef}`
                              : "No locked unit"}
                            {form.isAvailable ? "" : " · Hidden"}
                          </p>
                        </div>
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/inspections/manage/${form.id}`}>
                            Open
                          </Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {!inspection.inheritsQuestions ? (
            <Card>
              <CardHeader>
                <CardTitle>Sections ({sections.length})</CardTitle>
                <CardDescription>
                  Define checklist sections here first, then assign each question
                  to a section below. Toggle whether operators must sign at the
                  end of each section.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Form
                  key={sectionFormKey}
                  method="post"
                  className="grid gap-4 rounded-lg border border-border/70 bg-background/50 p-4"
                >
                  <input type="hidden" name="intent" value="add-section" />
                  <p className="text-sm font-medium text-brand-navy">
                    Add section
                  </p>
                  <div className="grid gap-2">
                    <Label htmlFor="section-title-new">Section title</Label>
                    <Input
                      id="section-title-new"
                      name="title"
                      required
                      placeholder="e.g. Before start"
                      autoComplete="off"
                    />
                  </div>
                  <label className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="requiresSignature"
                      defaultChecked
                      className="mt-0.5 size-4 accent-[var(--brand-navy)]"
                    />
                    <span>
                      Requires signature at end of section
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        Operators sign or initial after completing this section.
                      </span>
                    </span>
                  </label>
                  <div>
                    <Button type="submit">Add section</Button>
                  </div>
                </Form>

                {sections.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No sections yet. Add one above, then pick it when adding
                    questions.
                  </p>
                ) : (
                  <ul className="grid gap-3">
                    {sections.map((section, index) => (
                      <SectionEditor
                        key={section.id}
                        section={section}
                        questions={inspection.questions}
                        index={index}
                        total={sections.length}
                        isEditing={editingSectionId === section.id}
                        onEdit={() => setEditingSectionId(section.id)}
                        onCancel={() => setEditingSectionId(null)}
                      />
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Add question</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions ? (
                  <>
                    Questions are edited on the master template, not this unit
                    form.
                  </>
                ) : (
                  <>
                    Choose yes/no, number, date, a text box, or radio options.
                    Mark which answers should flag “needs attention”. You can
                    also limit questions to Day/Afternoon shift or the first
                    inspection of the week. Question edits go live right away
                    {inspection.unitFormCount > 0
                      ? " for every unit form"
                      : ""}
                    ; publish one revision when the whole batch is ready.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {inspection.inheritsQuestions && inspection.questionSourceId ? (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">
                    Shared checklist:{" "}
                    <span className="font-medium text-foreground">
                      {inspection.questionSourceTitle}
                    </span>
                  </p>
                  <div>
                    <Button asChild>
                      <Link
                        to={`/inspections/manage/${inspection.questionSourceId}`}
                      >
                        Edit shared questions
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <Form key={questionFormKey} method="post" className="grid gap-4">
                  <input type="hidden" name="intent" value="add-question" />
                  <ChecklistQuestionFields
                    kind="inspection"
                    questionType={questionType}
                    setQuestionType={setQuestionType}
                    radioOptions={radioOptions}
                    setRadioOptions={setRadioOptions}
                    unitOptions={inspection.unitOptions}
                    sections={sections}
                  />
                  <div>
                    <Button type="submit">Add question</Button>
                  </div>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Questions ({inspection.questions.length})</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions ? (
                  <>
                    Read-only preview of the shared checklist. Use “Edit shared
                    questions” above to change wording, options, or order.
                  </>
                ) : (
                  <>
                    Edit wording and options, or move questions up and down.
                    Removing a question hides it from new submissions; past runs
                    keep their answers. Publish a form revision when you finish
                    a set of changes.
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {inspection.inheritsQuestions ? (
                <ol className="grid gap-3">
                  {inspection.questions.map((question, index) => (
                    <li
                      key={question.id}
                      className="rounded-lg border border-border/70 px-3 py-3 text-sm"
                    >
                      <p className="font-medium text-brand-navy">
                        <span className="text-muted-foreground">
                          #{index + 1}
                        </span>{" "}
                        {question.label}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {questionTypeLabel(question.type)}
                        {question.sectionTitle
                          ? ` · ${question.sectionTitle}`
                          : ""}
                        {question.required ? "" : " · Optional"}
                        {question.showLastValue ? " · Shows last value" : ""}
                        {question.applicableEquipmentRefs.length > 0
                          ? ` · ${question.applicableEquipmentRefs.join(", ")}`
                          : ""}
                        {question.applicableShifts.length > 0
                          ? ` · ${question.applicableShifts.join("/")} shift`
                          : ""}
                        {question.firstOfWeekOnly ? " · First of week" : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : inspection.questions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No questions yet. Add one above.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {inspection.questions.map((question, index) => (
                    <ChecklistQuestionEditor
                      key={question.id}
                      kind="inspection"
                      question={question}
                      index={index}
                      total={inspection.questions.length}
                      isEditing={editingQuestionId === question.id}
                      onEdit={() => setEditingQuestionId(question.id)}
                      onCancel={() => setEditingQuestionId(null)}
                      unitOptions={inspection.unitOptions}
                      sections={sections}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {!inspection.inheritsQuestions ? (
            <Card>
              <CardHeader>
                <CardTitle>Publish revision</CardTitle>
                <CardDescription>
                  Batch any number of question edits into one form revision.
                  Five question changes still become Rev {inspection.version} →
                  Rev {inspection.version + 1}, with one overall comment.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {inspection.hasUnpublishedChanges ? (
                  <Form
                    method="post"
                    className="grid gap-4"
                    key={`publish-${inspection.version}`}
                  >
                    <input type="hidden" name="intent" value="publish-version" />
                    <div className="grid gap-2 rounded-lg border border-amber-200/80 bg-amber-50/60 px-3 py-3">
                      <Label htmlFor="changeComment-publish">
                        Revision comment (required)
                      </Label>
                      <Textarea
                        id="changeComment-publish"
                        name="changeComment"
                        rows={3}
                        required
                        placeholder="Summarise what changed in this checklist revision and why"
                      />
                      <p className="text-xs text-muted-foreground">
                        This creates version {inspection.version + 1} and stores
                        a snapshot of the full checklist.
                      </p>
                    </div>
                    <div>
                      <Button type="submit">
                        Publish as version {inspection.version + 1}
                      </Button>
                    </div>
                  </Form>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Checklist matches published version {inspection.version}.
                    Edit questions above, then come back here to publish one
                    revision for the whole batch.
                  </p>
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
              <CardDescription>
                {inspection.inheritsQuestions
                  ? "Version history for the shared master checklist."
                  : "Each published revision stores one manager comment and a snapshot of the full checklist."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VersionHistory versions={inspection.versions} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
