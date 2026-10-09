import { format, isValid, parse } from "date-fns";
import { enAU } from "date-fns/locale";

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM_RE = /^(\d{2}):(\d{2})$/;

function parseYmd(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const match = YMD_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Local calendar date from a YYYY-MM-DD form value (avoids UTC day shift). */
export function ymdToLocalDate(value: string | null | undefined): Date | undefined {
  const ymd = parseYmd(value);
  if (!ymd) {
    return undefined;
  }
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return isValid(date) ? date : undefined;
}

/** Serialize a local Date to YYYY-MM-DD for form storage. */
export function localDateToYmd(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Human-readable date for picker triggers (en-AU). */
export function formatYmdDisplay(value: string | null | undefined): string | null {
  const date = ymdToLocalDate(value);
  if (!date) {
    return null;
  }
  return format(date, "d MMM yyyy", { locale: enAU });
}

export function parseHm(
  value: string | null | undefined,
): { hour: string; minute: string } | null {
  if (!value) {
    return null;
  }
  const match = HM_RE.exec(value.trim());
  if (!match) {
    return null;
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour: match[1], minute: match[2] };
}

export function formatHm(hour: string, minute: string): string {
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** Human-readable 24h time for picker triggers. */
export function formatHmDisplay(value: string | null | undefined): string | null {
  const parts = parseHm(value);
  if (!parts) {
    return null;
  }
  const date = parse(`${parts.hour}:${parts.minute}`, "HH:mm", new Date());
  if (!isValid(date)) {
    return null;
  }
  return format(date, "HH:mm");
}

export const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) =>
  String(hour).padStart(2, "0"),
);

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);
