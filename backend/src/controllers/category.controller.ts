import type { Request, RequestHandler } from "express";
import { z } from "zod";
import * as categoryService from "../services/category.service";
import { HttpError } from "../utils/http-error";
import { sendData } from "../utils/responses";
import { parseBody } from "../utils/validation";

const categoryFields = {
  name: z.string().trim().min(3, "Nama kategori minimal 3 karakter").max(60, "Nama kategori maksimal 60 karakter"),
  slug: z.string().trim().min(3).max(60).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung"),
  isActive: z.boolean()
};

const createCategorySchema = z.object({
  name: categoryFields.name,
  slug: categoryFields.slug,
  isActive: categoryFields.isActive.optional()
});

const updateCategorySchema = z.object({
  name: categoryFields.name.optional(),
  slug: categoryFields.slug.optional(),
  isActive: categoryFields.isActive.optional()
}).refine((body) => Object.keys(body).length > 0, "Minimal satu field kategori harus diisi");

function categoryId(request: Request): number {
  const result = z.coerce.number().int().positive().safeParse(request.params.id);
  if (result.success) return result.data;
  throw new HttpError(422, "VALIDATION_ERROR", "Data tidak valid", {
    id: "ID kategori harus berupa bilangan bulat positif"
  });
}

export const listAdminCategories: RequestHandler = async (_request, response) => {
  sendData(response, await categoryService.listAdminCategories());
};

export const createCategory: RequestHandler = async (request, response) => {
  const body = parseBody(createCategorySchema, request.body);
  sendData(response, await categoryService.createCategory(body), 201);
};

export const updateCategory: RequestHandler = async (request, response) => {
  const body = parseBody(updateCategorySchema, request.body);
  sendData(response, await categoryService.updateCategory(categoryId(request), body));
};
