import {
  getFormProps,
  useForm,
  type SubmissionResult,
} from "@conform-to/react";
import { parseWithZod } from "@conform-to/zod/v4";
import { Form, useNavigation } from "react-router";

import { Alert, AlertDescription } from "~/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

import { formatLastAnswerDisplay } from "~/lib/inspections";
import {
  createPermitCopyFormSchema,
  PERMIT_COPY_INLINE_FIELD_LIMIT,
  permitCopyFieldPreview,
  type CopyablePermitField,
  type CopyablePermitHeading,
} from "~/lib/permit-copy";

type Props = {
  headings: CopyablePermitHeading[];
  lastResult?: SubmissionResult<string[]> | null;
  error?: string | null;
};

function formatCopyAnswer(field: CopyablePermitField): string {
  return formatLastAnswerDisplay(field.answer, field.type).trim() || "—";
}

function fieldLabelVisible(field: CopyablePermitField, sectionTitle: string) {
  return field.label.trim().toLowerCase() !== sectionTitle.trim().toLowerCase();
}

function CopyFieldList({
  fields,
  sectionTitle,
}: {
  fields: CopyablePermitField[];
  sectionTitle: string;
}) {
  return (
    <ul className="mt-2 grid gap-2">
      {fields.map((field) => {
        const showLabel = fieldLabelVisible(field, sectionTitle);
        return (
          <li
            key={field.label}
            className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm"
          >
            {showLabel ? (
              <span className="min-w-0 flex-1 text-muted-foreground">
                {field.label}
              </span>
            ) : null}
            <span
              className={
                showLabel
                  ? "max-w-full shrink-0 text-right font-medium text-brand-navy"
                  : "font-medium text-brand-navy"
              }
            >
              {formatCopyAnswer(field)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function CopyFieldPreview({
  fields,
  sectionTitle,
}: {
  fields: CopyablePermitField[];
  sectionTitle: string;
}) {
  const { preview, remaining } = permitCopyFieldPreview(fields);
  return (
    <div className="mt-1 grid gap-1 text-sm text-muted-foreground">
      {preview.map((field) => {
        const showLabel = fieldLabelVisible(field, sectionTitle);
        const answer = formatCopyAnswer(field);
        return (
          <p key={field.label} className="truncate">
            {showLabel ? (
              <>
                <span>{field.label}</span>
                <span className="text-muted-foreground/70"> — </span>
              </>
            ) : null}
            <span className="font-medium text-brand-navy/80">{answer}</span>
          </p>
        );
      })}
      {remaining > 0 ? (
        <p className="text-xs text-muted-foreground">
          +{remaining} more with answers
        </p>
      ) : null}
    </div>
  );
}

function SectionFields({ heading }: { heading: CopyablePermitHeading }) {
  const { fields, title } = heading;
  if (fields.length === 0) {
    return null;
  }

  if (fields.length <= PERMIT_COPY_INLINE_FIELD_LIMIT) {
    return <CopyFieldList fields={fields} sectionTitle={title} />;
  }

  return (
    <Accordion type="single" collapsible className="mt-1 w-full">
      <AccordionItem
        value={`${heading.key}-answers`}
        className="group/copy-section border-0"
      >
        <div className="group-data-[state=open]/copy-section:hidden">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-normal">
              {fields.length} questions
            </Badge>
          </div>
          <CopyFieldPreview fields={fields} sectionTitle={title} />
        </div>
        <AccordionTrigger className="py-2 text-sm text-brand-navy hover:no-underline">
          <span className="group-aria-expanded/accordion-trigger:hidden">
            Show answers
          </span>
          <span className="hidden group-aria-expanded/accordion-trigger:inline">
            Hide answers
          </span>
        </AccordionTrigger>
        <AccordionContent className="pb-0">
          <CopyFieldList fields={fields} sectionTitle={title} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function PermitCopyForm({ headings, lastResult, error }: Props) {
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const schema = createPermitCopyFormSchema(headings.map((heading) => heading.key));
  const [form, fields] = useForm({
    lastResult: lastResult ?? undefined,
    onValidate({ formData }) {
      return parseWithZod(formData, { schema });
    },
    shouldValidate: "onSubmit",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Copy to a new permit</CardTitle>
        <CardDescription>
          Tick the sections you want to copy. That selects every field under
          the section, except signatures, dates, and times — those always stay
          blank on the new permit.
        </CardDescription>
      </CardHeader>
      <Form method="post" {...getFormProps(form)}>
        <CardContent className="grid gap-4">
          {headings.length > 0 ? (
            <fieldset className="grid gap-3">
              <legend className="text-sm font-medium">Sections to copy</legend>
              {headings.map((heading) => {
                const inputId = `${fields.heading.id}-${heading.key}`;
                return (
                  <div
                    key={heading.key}
                    className="rounded-lg border border-border/70 bg-background/40 p-4 has-[:checked]:border-brand/50 has-[:checked]:bg-brand/10"
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id={inputId}
                        name={fields.heading.name}
                        value={heading.key}
                        className="mt-1 size-4 accent-[var(--brand-navy)]"
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={inputId}
                          className="block cursor-pointer font-medium text-brand-navy"
                        >
                          {heading.title}
                        </label>
                        <SectionFields heading={heading} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </fieldset>
          ) : (
            <p className="text-sm text-muted-foreground">
              This closed permit has no sections that can be copied.
              Signatures, dates, and times are never copied. You can still
              start a blank permit of the same type.
            </p>
          )}
          {fields.heading.errors ? (
            <Alert variant="destructive">
              <AlertDescription>
                {fields.heading.errors.join(" ")}
              </AlertDescription>
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {form.errors ? (
            <Alert variant="destructive">
              <AlertDescription>{form.errors.join(" ")}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Opening…" : "Create new permit"}
          </Button>
        </CardFooter>
      </Form>
    </Card>
  );
}
