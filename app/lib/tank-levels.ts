export type TankLevelsUserRole = "STANDARD" | "APPROVER" | "ADMIN";

export type DefaultTank = {
  code: string;
  product: string;
  capacityKg: number;
  sortOrder: number;
};

/** Built-in bulk tank roster (codes without trailing *). */
export const DEFAULT_TANKS: DefaultTank[] = [
  { code: "F114", product: "ZAMA1143", capacityKg: 40000, sortOrder: 10 },
  { code: "F216A", product: "GR", capacityKg: 40000, sortOrder: 20 },
  { code: "F216B", product: "GR", capacityKg: 40000, sortOrder: 30 },
  { code: "F501", product: "H2SO4 - 8Z007", capacityKg: 6500, sortOrder: 40 },
  { code: "F501A", product: "20 XCEL", capacityKg: 40000, sortOrder: 50 },
  { code: "F501D", product: "20 XCEL", capacityKg: 40000, sortOrder: 60 },
  { code: "F501E", product: "Poly 973", capacityKg: 40000, sortOrder: 70 },
  { code: "F502A", product: "Poly AN04", capacityKg: 40000, sortOrder: 80 },
  { code: "F501B", product: "Crep A9925", capacityKg: 40000, sortOrder: 90 },
  { code: "F512K", product: "16 XCEL", capacityKg: 80000, sortOrder: 100 },
  { code: "F513K", product: "716LX", capacityKg: 80000, sortOrder: 110 },
  { code: "T3", product: "HXKD", capacityKg: 40000, sortOrder: 120 },
  { code: "T452", product: "7397", capacityKg: 52000, sortOrder: 130 },
  { code: "T453", product: "7397", capacityKg: 55000, sortOrder: 140 },
  { code: "T454", product: "HXHCE", capacityKg: 55000, sortOrder: 150 },
  { code: "T455", product: "HXHCE", capacityKg: 55000, sortOrder: 160 },
  { code: "T456", product: "7396", capacityKg: 105000, sortOrder: 170 },
  { code: "T458", product: "Alum - 8M533", capacityKg: 40000, sortOrder: 180 },
  { code: "F112", product: "Alum - 8M533", capacityKg: 40000, sortOrder: 190 },
];

/** Strip trailing * (and surrounding whitespace) from a tank code. */
export function normalizeTankCode(code: string): string {
  return code.trim().replace(/\*+$/g, "").trim().toUpperCase();
}

export function isOverCapacity(levelKg: number, capacityKg: number): boolean {
  return levelKg > capacityKg;
}

export function overCapacityWarning(
  levelKg: number,
  capacityKg: number,
): string | null {
  if (!isOverCapacity(levelKg, capacityKg)) {
    return null;
  }
  return `Over capacity (${capacityKg.toLocaleString("en-AU")} kg)`;
}

export function canLogTankLevelsToday(_role: TankLevelsUserRole): boolean {
  return true;
}

export function canEditTankLevelsForDay(
  role: TankLevelsUserRole,
  dayYmd: string,
  todayYmd: string,
): boolean {
  if (dayYmd === todayYmd) {
    return true;
  }
  return role === "ADMIN";
}

export function canManageTanks(role: TankLevelsUserRole): boolean {
  return role === "ADMIN";
}

export type TankDaySummaryInput = {
  totalActive: number;
  loggedCount: number;
  lastUpdatedAt: Date | string | null;
};

export function summarizeTankDay(input: TankDaySummaryInput) {
  const missingCount = Math.max(0, input.totalActive - input.loggedCount);
  return {
    totalActive: input.totalActive,
    loggedCount: input.loggedCount,
    missingCount,
    complete:
      input.totalActive > 0 && input.loggedCount >= input.totalActive,
    lastUpdatedAt: input.lastUpdatedAt,
  };
}
