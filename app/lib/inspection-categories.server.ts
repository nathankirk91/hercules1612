import { PERMIT_CATEGORY } from "~/lib/inspections";
import { getPrisma } from "~/lib/db.server";
import { ensureInspectionSchema } from "~/lib/migrate.server";

export type InspectionCategoryRecord = {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

function isMissingCategorySchemaError(error: unknown): boolean {
  return /inspection_categories|does not exist|ColumnNotFound/i.test(
    error instanceof Error ? error.message : String(error ?? ""),
  );
}

async function withCategorySchemaRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!isMissingCategorySchemaError(error)) {
      throw error;
    }
    await ensureInspectionSchema();
    return fn();
  }
}

export async function listInspectionCategories(args?: {
  includeInactive?: boolean;
  /** When true (default), omit the reserved Permits category used by permit forms. */
  excludePermits?: boolean;
}): Promise<InspectionCategoryRecord[]> {
  const includeInactive = args?.includeInactive ?? false;
  const excludePermits = args?.excludePermits ?? true;

  return withCategorySchemaRetry(async () => {
    const prisma = getPrisma();
    if (!prisma) {
      return [];
    }

    const rows = await prisma.inspectionCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return rows
      .filter((row) =>
        excludePermits
          ? row.name.trim().toLowerCase() !== PERMIT_CATEGORY.toLowerCase()
          : true,
      )
      .map((row) => ({
        id: row.id,
        name: row.name,
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      }));
  });
}

export async function createInspectionCategory(args: {
  name: string;
}): Promise<InspectionCategoryRecord> {
  return withCategorySchemaRetry(async () => {
    const prisma = getPrisma();
    if (!prisma) {
      throw new Error("Database is not configured.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Category name is required.");
    }
    if (name.toLowerCase() === PERMIT_CATEGORY.toLowerCase()) {
      throw new Error(
        "Permits is reserved for work permits. Manage those under Permits → Manage.",
      );
    }

    const existing = await prisma.inspectionCategory.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      throw new Error("A category with that name already exists.");
    }

    const maxSort = await prisma.inspectionCategory.aggregate({
      _max: { sortOrder: true },
    });

    const row = await prisma.inspectionCategory.create({
      data: {
        name,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isActive: true,
      },
    });

    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  });
}

export async function updateInspectionCategory(args: {
  categoryId: string;
  name: string;
  isActive: boolean;
}): Promise<InspectionCategoryRecord> {
  return withCategorySchemaRetry(async () => {
    const prisma = getPrisma();
    if (!prisma) {
      throw new Error("Database is not configured.");
    }

    const name = args.name.trim();
    if (!name) {
      throw new Error("Category name is required.");
    }
    if (name.toLowerCase() === PERMIT_CATEGORY.toLowerCase()) {
      throw new Error(
        "Permits is reserved for work permits. Manage those under Permits → Manage.",
      );
    }

    const existing = await prisma.inspectionCategory.findUnique({
      where: { id: args.categoryId },
    });
    if (!existing) {
      throw new Error("Category not found.");
    }
    if (existing.name.toLowerCase() === PERMIT_CATEGORY.toLowerCase()) {
      throw new Error("The Permits category cannot be edited here.");
    }

    const clash = await prisma.inspectionCategory.findFirst({
      where: {
        id: { not: args.categoryId },
        name: { equals: name, mode: "insensitive" },
      },
    });
    if (clash) {
      throw new Error("A category with that name already exists.");
    }

    const previousName = existing.name;
    const row = await prisma.inspectionCategory.update({
      where: { id: args.categoryId },
      data: {
        name,
        isActive: args.isActive,
      },
    });

    if (previousName !== name) {
      await prisma.inspection.updateMany({
        where: {
          category: previousName,
          NOT: { category: { equals: PERMIT_CATEGORY, mode: "insensitive" } },
        },
        data: { category: name },
      });
    }

    return {
      id: row.id,
      name: row.name,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
    };
  });
}

export async function deleteInspectionCategory(
  categoryId: string,
): Promise<void> {
  return withCategorySchemaRetry(async () => {
    const prisma = getPrisma();
    if (!prisma) {
      throw new Error("Database is not configured.");
    }

    const existing = await prisma.inspectionCategory.findUnique({
      where: { id: categoryId },
    });
    if (!existing) {
      throw new Error("Category not found.");
    }
    if (existing.name.toLowerCase() === PERMIT_CATEGORY.toLowerCase()) {
      throw new Error("The Permits category cannot be deleted.");
    }

    const inUse = await prisma.inspection.count({
      where: {
        category: { equals: existing.name, mode: "insensitive" },
      },
    });
    if (inUse > 0) {
      throw new Error(
        "Reassign or update inspections using this category before deleting it.",
      );
    }

    await prisma.inspectionCategory.delete({
      where: { id: categoryId },
    });
  });
}

/** Ensure common defaults and backfill from existing inspection.category values. */
export async function ensureInspectionCategories(): Promise<void> {
  return withCategorySchemaRetry(async () => {
    const prisma = getPrisma();
    if (!prisma) {
      return;
    }

    const defaults = ["Equipment", "Shift", "General"];
    for (const [index, name] of defaults.entries()) {
      const existing = await prisma.inspectionCategory.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (!existing) {
        await prisma.inspectionCategory.create({
          data: { name, sortOrder: index, isActive: true },
        });
      }
    }

    const used = await prisma.inspection.findMany({
      select: { category: true },
      distinct: ["category"],
    });

    for (const row of used) {
      const name = row.category.trim();
      if (!name) {
        continue;
      }
      const existing = await prisma.inspectionCategory.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });
      if (!existing) {
        const maxSort = await prisma.inspectionCategory.aggregate({
          _max: { sortOrder: true },
        });
        await prisma.inspectionCategory.create({
          data: {
            name,
            sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
            isActive: true,
          },
        });
      }
    }
  });
}
