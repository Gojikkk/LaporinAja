import { prisma } from "../db";
import { HttpError } from "../utils/http-error";

type CreateCategoryInput = {
  name: string;
  slug: string;
  isActive?: boolean;
};

type UpdateCategoryInput = Partial<CreateCategoryInput>;

function mapUniqueCategoryError(error: unknown): never {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") {
    throw error;
  }

  const target = "meta" in error && error.meta && typeof error.meta === "object" &&
    "target" in error.meta
    ? String(error.meta.target)
    : "";
  const fields: Record<string, string> = {};
  if (!target || target.includes("name")) fields.name = "Nama kategori sudah digunakan";
  if (!target || target.includes("slug")) fields.slug = "Slug kategori sudah digunakan";
  if (!Object.keys(fields).length) {
    fields.category = "Nama atau slug kategori sudah digunakan";
  }
  throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid", fields);
}

export async function listAdminCategories() {
  return prisma.reportCategory.findMany({
    select: { id: true, name: true, slug: true, isActive: true },
    orderBy: { id: "asc" }
  });
}

export async function createCategory(input: CreateCategoryInput) {
  try {
    return await prisma.reportCategory.create({
      data: {
        name: input.name,
        slug: input.slug,
        isActive: input.isActive ?? true
      },
      select: { id: true, name: true, slug: true, isActive: true }
    });
  } catch (error) {
    mapUniqueCategoryError(error);
  }
}

export async function updateCategory(id: number, input: UpdateCategoryInput) {
  const existing = await prisma.reportCategory.findUnique({
    where: { id },
    select: { id: true }
  });
  if (!existing) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan");

  try {
    return await prisma.reportCategory.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {})
      },
      select: { id: true, name: true, slug: true, isActive: true }
    });
  } catch (error) {
    mapUniqueCategoryError(error);
  }
}
