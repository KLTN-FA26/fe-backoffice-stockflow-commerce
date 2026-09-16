import { PRODUCT_STATUS } from "@/constants";
import { ApiError } from "@/lib/api";

import type { CreateProductInput } from "./schemas";
import type { ProductAttribute, ProductStatus, PrintTechnique } from "./types";

export type CreateProductServerField =
  | "attributes"
  | "brand"
  | "categoryId"
  | "description"
  | "descriptionEn"
  | "images"
  | "model3dUrl"
  | "name"
  | "nameEn"
  | "printAreas"
  | "productCode"
  | "productId"
  | "taxClass"
  | "type"
  | "uom";

export type CreateProductServerErrors = Partial<Record<CreateProductServerField, string>>;

export interface ProductCreateFormSnapshot {
  productCode: string;
  name: string;
  nameEn: string;
  type: CreateProductInput["type"];
  categoryId: string;
  brand: string;
  taxClass: CreateProductInput["taxClass"];
  uom: CreateProductInput["uom"];
  description: string;
  descriptionEn: string;
  imageUrls: string;
  model3dUrl: string;
  printAreas: {
    id: string;
    name: string;
    position: "front" | "back" | "left-sleeve" | "right-sleeve" | "full";
    widthMm: string;
    heightMm: string;
    minDpi: string;
  }[];
  allowedTechniques: string[];
}

export interface SelectedProductAttribute {
  attr: ProductAttribute;
  values: string[];
}

export function buildCreateProductInput(
  form: ProductCreateFormSnapshot,
  selectedEntries: readonly SelectedProductAttribute[],
): CreateProductInput {
  const productId = form.productCode.trim();
  const images = form.imageUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  const allowedTechniques = normalizePrintTechniques(form.allowedTechniques);

  return {
    productId,
    name: form.name.trim(),
    nameEn: form.nameEn.trim() || form.name.trim(),
    type: form.type,
    categoryId: form.categoryId,
    description: form.description.trim(),
    descriptionEn: form.descriptionEn.trim() || form.description.trim(),
    images,
    model3dUrl: optionalTrim(form.model3dUrl),
    basePrice: 0,
    attributes: selectedEntries.map(({ attr, values }) => ({
      attributeId: attr.attributeId,
      name: attr.name,
      values,
      swatch: attr.swatch,
    })),
    printAreas:
      form.type === "Customizable"
        ? form.printAreas.map((area) => ({
            printAreaId: area.id,
            productId,
            name: { vi: area.name.trim(), en: area.name.trim() },
            position: area.position,
            widthMm: Number(area.widthMm),
            heightMm: Number(area.heightMm),
            minDpi: Number(area.minDpi),
            bleedMm: 0,
            safeMarginMm: 0,
            allowedTechniques,
          }))
        : undefined,
    taxClass: form.taxClass,
    uom: form.uom,
    brand: form.brand.trim(),
  };
}

export function mapCreateProductError(error: ApiError): {
  fieldErrors: CreateProductServerErrors;
  message: string;
  status?: ProductStatus;
} {
  const fieldErrors = normalizeFieldErrors(error.fieldErrors ?? {});
  if (error.code === "PRODUCT_CODE_ALREADY_EXISTS" && !fieldErrors.productCode) {
    fieldErrors.productCode = "Mã sản phẩm đã tồn tại.";
  }
  if (error.code === "CATEGORY_NOT_FOUND" && !fieldErrors.categoryId) {
    fieldErrors.categoryId = "Danh mục đã bị xoá hoặc không còn khả dụng.";
  }
  if (error.status === 403) {
    return {
      fieldErrors,
      message: "Bạn không có quyền tạo sản phẩm.",
      status: PRODUCT_STATUS.DRAFT,
    };
  }
  return {
    fieldErrors,
    message: error.message,
  };
}

function normalizeFieldErrors(fieldErrors: Record<string, string>): CreateProductServerErrors {
  const normalized: CreateProductServerErrors = {};
  for (const [field, message] of Object.entries(fieldErrors)) {
    const key = normalizeFieldName(field);
    if (key) normalized[key] = message;
  }
  return normalized;
}

function normalizeFieldName(field: string): CreateProductServerField | null {
  switch (field) {
    case "code":
    case "productCode":
    case "productId":
      return "productCode";
    case "attributes":
    case "brand":
    case "categoryId":
    case "description":
    case "descriptionEn":
    case "images":
    case "model3dUrl":
    case "name":
    case "nameEn":
    case "printAreas":
    case "taxClass":
    case "type":
    case "uom":
      return field;
    default:
      return null;
  }
}

function normalizePrintTechniques(values: readonly string[]): PrintTechnique[] {
  const techniques = values.filter((value): value is PrintTechnique =>
    ["DTG", "DTF", "Screen", "Embroidery", "Sublimation"].includes(value),
  );
  return techniques.length ? techniques : ["DTG"];
}

function optionalTrim(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
