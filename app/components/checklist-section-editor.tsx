import { Form } from "react-router";

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
import type { InspectionSectionDef } from "~/lib/inspections";

export function SectionEditor({
  section,
  questions,
  index,
  total,
  isEditing,
  onEdit,
  onCancel,
  showSignatureOption = true,
  showSkipRules = true,
}: {
  section: InspectionSectionDef;
  questions: Array<{ id: string; label: string; sectionId?: string | null }>;
  index: number;
  total: number;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  showSignatureOption?: boolean;
  showSkipRules?: boolean;
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
          {showSignatureOption ? (
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
          ) : (
            <input type="hidden" name="requiresSignature" value="" />
          )}
          {showSkipRules ? (
            <>
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
            </>
          ) : (
            <>
              <input type="hidden" name="skipWhenQuestionId" value="" />
              <input type="hidden" name="skipWhenEquals" value="" />
            </>
          )}
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
            {showSignatureOption ? (
              section.requiresSignature ? (
                <Badge variant="secondary">Signature required</Badge>
              ) : (
                <Badge variant="outline">No signature</Badge>
              )
            ) : null}
            {showSkipRules && section.skipWhenQuestionId ? (
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

export function ChecklistSectionsCard({
  sections,
  questions,
  sectionFormKey,
  editingSectionId,
  onEditSection,
  onCancelEdit,
  showSignatureOption = true,
  showSkipRules = true,
  description =
    "Define checklist sections here first, then assign each question to a section below. Toggle whether operators must sign at the end of each section.",
}: {
  sections: InspectionSectionDef[];
  questions: Array<{ id: string; label: string; sectionId?: string | null }>;
  sectionFormKey: number;
  editingSectionId: string | null;
  onEditSection: (sectionId: string) => void;
  onCancelEdit: () => void;
  showSignatureOption?: boolean;
  showSkipRules?: boolean;
  description?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sections ({sections.length})</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Form
          key={sectionFormKey}
          method="post"
          className="grid gap-4 rounded-lg border border-border/70 bg-background/50 p-4"
        >
          <input type="hidden" name="intent" value="add-section" />
          <p className="text-sm font-medium text-brand-navy">Add section</p>
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
          {showSignatureOption ? (
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
          ) : (
            <input type="hidden" name="requiresSignature" value="" />
          )}
          <div>
            <Button type="submit">Add section</Button>
          </div>
        </Form>

        {sections.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sections yet. Add one above, then pick it when adding questions.
          </p>
        ) : (
          <ul className="grid gap-3">
            {sections.map((section, index) => (
              <SectionEditor
                key={section.id}
                section={section}
                questions={questions}
                index={index}
                total={sections.length}
                isEditing={editingSectionId === section.id}
                onEdit={() => onEditSection(section.id)}
                onCancel={onCancelEdit}
                showSignatureOption={showSignatureOption}
                showSkipRules={showSkipRules}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
