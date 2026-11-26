import { getPrisma } from "~/lib/db.server";
import { DEFAULT_TANKS, summarizeTankDay } from "~/lib/tank-levels";

export type TankRecord = {
  id: string;
  code: string;
  product: string;
  capacityKg: number;
  sortOrder: number;
  isActive: boolean;
};

export type TankLevelReadingRecord = {
  id: string;
  tankId: string;
  day: string;
  levelKg: number;
  recordedById: string | null;
  updatedAt: Date;
};

export type TankDayRow = TankRecord & {
  levelKg: number | null;
  readingId: string | null;
  readingUpdatedAt: Date | null;
};

export type TankDaySummary = ReturnType<typeof summarizeTankDay> & {
  date: string;
};

async function ensureTankLevelsSchemaReady(): Promise<void> {
  const { ensureInspectionSchema } = await import("~/lib/migrate.server");
  await ensureInspectionSchema();
}

/** Upsert built-in tank roster. Does not change isActive on existing tanks. */
export async function seedDefaultTanks(): Promise<number> {
  const prisma = getPrisma();
  if (!prisma) {
    return 0;
  }

  await ensureTankLevelsSchemaReady();

  let count = 0;
  for (const tank of DEFAULT_TANKS) {
    const existing = await prisma.tank.findUnique({
      where: { code: tank.code },
      select: { id: true },
    });

    if (existing) {
      await prisma.tank.update({
        where: { code: tank.code },
        data: {
          product: tank.product,
          capacityKg: tank.capacityKg,
          sortOrder: tank.sortOrder,
        },
      });
    } else {
      await prisma.tank.create({
        data: {
          code: tank.code,
          product: tank.product,
          capacityKg: tank.capacityKg,
          sortOrder: tank.sortOrder,
          isActive: true,
        },
      });
    }
    count += 1;
  }

  return count;
}

export async function listTanks(options?: {
  activeOnly?: boolean;
}): Promise<TankRecord[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  await ensureTankLevelsSchemaReady();

  const rows = await prisma.tank.findMany({
    where: options?.activeOnly ? { isActive: true } : undefined,
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      product: true,
      capacityKg: true,
      sortOrder: true,
      isActive: true,
    },
  });

  return rows;
}

export async function listTankDayRows(day: string): Promise<TankDayRow[]> {
  const prisma = getPrisma();
  if (!prisma) {
    return [];
  }

  await ensureTankLevelsSchemaReady();

  const tanks = await prisma.tank.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      product: true,
      capacityKg: true,
      sortOrder: true,
      isActive: true,
      readings: {
        where: { day },
        select: {
          id: true,
          levelKg: true,
          updatedAt: true,
        },
        take: 1,
      },
    },
  });

  return tanks.map((tank) => {
    const reading = tank.readings[0] ?? null;
    return {
      id: tank.id,
      code: tank.code,
      product: tank.product,
      capacityKg: tank.capacityKg,
      sortOrder: tank.sortOrder,
      isActive: tank.isActive,
      levelKg: reading?.levelKg ?? null,
      readingId: reading?.id ?? null,
      readingUpdatedAt: reading?.updatedAt ?? null,
    };
  });
}

export async function getTankDaySummary(day: string): Promise<TankDaySummary> {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      date: day,
      ...summarizeTankDay({
        totalActive: 0,
        loggedCount: 0,
        lastUpdatedAt: null,
      }),
    };
  }

  await ensureTankLevelsSchemaReady();

  const [totalActive, readings] = await Promise.all([
    prisma.tank.count({ where: { isActive: true } }),
    prisma.tankLevelReading.findMany({
      where: {
        day,
        tank: { isActive: true },
      },
      select: { updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    date: day,
    ...summarizeTankDay({
      totalActive,
      loggedCount: readings.length,
      lastUpdatedAt: readings[0]?.updatedAt ?? null,
    }),
  };
}

export async function saveTankDayLevels(args: {
  day: string;
  entries: Array<{ tankId: string; levelKg: number }>;
  recordedById: string;
}): Promise<{ saved: number }> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await ensureTankLevelsSchemaReady();

  if (args.entries.length === 0) {
    return { saved: 0 };
  }

  const tankIds = args.entries.map((entry) => entry.tankId);
  const activeTanks = await prisma.tank.findMany({
    where: { id: { in: tankIds }, isActive: true },
    select: { id: true },
  });
  const activeIds = new Set(activeTanks.map((tank) => tank.id));

  let saved = 0;
  await prisma.$transaction(
    args.entries
      .filter((entry) => activeIds.has(entry.tankId))
      .map((entry) =>
        prisma.tankLevelReading.upsert({
          where: {
            tankId_day: { tankId: entry.tankId, day: args.day },
          },
          create: {
            tankId: entry.tankId,
            day: args.day,
            levelKg: entry.levelKg,
            recordedById: args.recordedById,
          },
          update: {
            levelKg: entry.levelKg,
            recordedById: args.recordedById,
          },
        }),
      ),
  );
  saved = args.entries.filter((entry) => activeIds.has(entry.tankId)).length;

  return { saved };
}

export async function createTank(args: {
  code: string;
  product: string;
  capacityKg: number;
  sortOrder: number;
  isActive: boolean;
}): Promise<TankRecord> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await ensureTankLevelsSchemaReady();

  try {
    return await prisma.tank.create({
      data: {
        code: args.code,
        product: args.product,
        capacityKg: args.capacityKg,
        sortOrder: args.sortOrder,
        isActive: args.isActive,
      },
      select: {
        id: true,
        code: true,
        product: true,
        capacityKg: true,
        sortOrder: true,
        isActive: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate/i.test(error.message)
    ) {
      throw new Error(`Tank code ${args.code} already exists.`);
    }
    throw error;
  }
}

export async function updateTank(args: {
  tankId: string;
  code: string;
  product: string;
  capacityKg: number;
  sortOrder: number;
  isActive: boolean;
}): Promise<TankRecord> {
  const prisma = getPrisma();
  if (!prisma) {
    throw new Error("Database is not configured.");
  }

  await ensureTankLevelsSchemaReady();

  try {
    return await prisma.tank.update({
      where: { id: args.tankId },
      data: {
        code: args.code,
        product: args.product,
        capacityKg: args.capacityKg,
        sortOrder: args.sortOrder,
        isActive: args.isActive,
      },
      select: {
        id: true,
        code: true,
        product: true,
        capacityKg: true,
        sortOrder: true,
        isActive: true,
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      /unique|duplicate/i.test(error.message)
    ) {
      throw new Error(`Tank code ${args.code} already exists.`);
    }
    throw error;
  }
}
