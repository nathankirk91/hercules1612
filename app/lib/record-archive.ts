/** Shared validation for archiving permit and inspection records. */

export function normalizeArchiveReason(reason: string): string {
  const trimmed = reason.trim();
  if (!trimmed) {
    throw new Error("An archive comment is required.");
  }
  return trimmed;
}
