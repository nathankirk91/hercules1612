/** Keep a hidden input in sync for mobile browsers (e.g. iOS Safari / PWA). */
export function syncHiddenInputValue(
  input: HTMLInputElement | null | undefined,
  value: string,
) {
  if (!input) {
    return;
  }
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
