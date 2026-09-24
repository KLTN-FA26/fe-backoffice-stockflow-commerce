import { PRODUCT_STATUS } from "@/constants";
import { ApiError } from "@/lib/api";

import type { CreateProductInput, ProductDraftFormValues } from "./schemas";
import type { Product, ProductStatus } from "./types";

export type CreateProductServerField = keyof ProductDraftFormValues;

export type CreateProductServerErrors = Partial<Record<CreateProductServerField, string>>;

export type ProductCreateFormSnapshot = ProductDraftFormValues;

export const PRODUCT_DRAFT_FORM_DEFAULTS: ProductDraftFormValues = {
  brand: "",
  categoryId: "",
  customizable: false,
  description: "",
  descriptionEn: "",
  heightCm: "",
  imageUrls: "",
  lengthCm: "",
  name: "",
  nameEn: "",
  productCode: "",
  taxClass: "STANDARD",
  weightKg: "",
  widthCm: "",
};

export function productToDraftForm(product: Product): ProductDraftFormValues {
  return {
    brand: product.brand,
    categoryId: product.categoryId ?? "",
    customizable: product.type === "Customizable",
    description: product.description,
    descriptionEn: product.descriptionEn,
    heightCm: numberText(product.heightCm),
    imageUrls: product.images.join("\n"),
    lengthCm: numberText(product.lengthCm),
    name: product.name,
    nameEn: product.nameEn,
    productCode: product.code ?? product.productId,
    taxClass: product.taxClass.toUpperCase() as ProductDraftFormValues["taxClass"],
    weightKg: numberText(product.weightKg),
    widthCm: numberText(product.widthCm),
  };
}

export function buildCreateProductInput(form: ProductCreateFormSnapshot): CreateProductInput {
  const images = form.imageUrls
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    code: form.productCode.trim(),
    name: form.name.trim(),
    nameEn: form.nameEn.trim(),
    categoryId: form.categoryId.trim(),
    description: form.description.trim(),
    descriptionEn: form.descriptionEn.trim(),
    brand: form.brand.trim(),
    taxClass: form.taxClass,
    customizable: form.customizable,
    images,
    weightKg: optionalNumber(form.weightKg),
    lengthCm: optionalNumber(form.lengthCm),
    widthCm: optionalNumber(form.widthCm),
    heightCm: optionalNumber(form.heightCm),
  };
}

export function mapCreateProductError(error: ApiError): {
  fieldErrors: CreateProductServerErrors;
  message: string;
  status?: ProductStatus;
} {
  const fieldErrors = normalizeFieldErrors(error.fieldErrors ?? {});
  if (error.code === "VALIDATION_FAILED") localizeKnownValidationFields(fieldErrors);
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

function localizeKnownValidationFields(fieldErrors: CreateProductServerErrors): void {
  const messages: Partial<Record<CreateProductServerField, string>> = {
    productCode: "Mã sản phẩm không hợp lệ.",
    name: "Tên sản phẩm không hợp lệ.",
    nameEn: "Tên tiếng Anh không hợp lệ.",
    brand: "Thương hiệu không hợp lệ.",
    categoryId: "Danh mục không hợp lệ.",
    weightKg: "Khối lượng phải lớn hơn 0.",
    lengthCm: "Chiều dài phải lớn hơn 0.",
    widthCm: "Chiều rộng phải lớn hơn 0.",
    heightCm: "Chiều cao phải lớn hơn 0.",
  };
  for (const field of Object.keys(fieldErrors) as CreateProductServerField[]) {
    if (messages[field]) fieldErrors[field] = messages[field];
  }
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
    case "images":
      return "imageUrls";
    case "brand":
    case "categoryId":
    case "customizable":
    case "description":
    case "descriptionEn":
    case "heightCm":
    case "imageUrls":
    case "lengthCm":
    case "name":
    case "nameEn":
    case "taxClass":
    case "weightKg":
    case "widthCm":
      return field;
    default:
      return null;
  }
}

function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  return trimmed ? Number(trimmed) : null;
}

function numberText(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}
