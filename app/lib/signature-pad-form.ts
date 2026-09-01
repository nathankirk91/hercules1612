/** Keep a form field in sync for mobile browsers (e.g. iOS Safari / PWA). */
export function syncFormFieldValue(
  field: HTMLInputElement | HTMLTextAreaElement | null | undefined,
  value: string,
) {
  if (!field) {
    return;
  }
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

/** @deprecated Use syncFormFieldValue */
export function syncHiddenInputValue(
  input: HTMLInputElement | null | undefined,
  value: string,
) {
  syncFormFieldValue(input, value);
}

/** Read section signature values from Conform dot or legacy bracket field names. */
export function readSectionSignaturesFromFormData(
  formData: FormData,
): Record<string, string> {
  const signatures: Record<string, string> = {};

  for (const [key, rawValue] of formData.entries()) {
    const value = String(rawValue ?? "").trim();
    if (!value) {
      continue;
    }

    if (key.startsWith("sectionSignatures.")) {
      const sectionKey = key.slice("sectionSignatures.".length);
      if (sectionKey) {
        signatures[sectionKey] = value;
      }
      continue;
    }

    const bracketMatch = /^sectionSignatures\[(.+)\]$/.exec(key);
    if (bracketMatch) {
      signatures[bracketMatch[1]] = value;
    }
  }

  return signatures;
}

export function pickLatestSectionSignature(
  signatures: Record<string, string>,
): string | null {
  const values = Object.values(signatures)
    .map((value) => value.trim())
    .filter(Boolean);
  return values.at(-1) ?? null;
}
