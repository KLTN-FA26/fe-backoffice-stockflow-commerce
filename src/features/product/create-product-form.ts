import { PRODUCT_STATUS } from "@/constants";
import { ApiError } from "@/lib/api";

import type { CreateProductInput, ProductDraftFormValues } from "./schemas";
import type { Product, ProductStatus } from "./types";

export type CreateProductServerField = keyof ProductDraftFormValues;

export type CreateProductServerErrors = Partial<Record<CreateProductServerField, string>>;

export type ProductCreateFormSnapshot = ProductDraftFormValues;

export const PRODUCT_DRAFT_FORM_DEFAULTS: ProductDraftFormValues = {
  brandId: "",
  categoryId: "",
  customizable: false,
  description: "",
  descriptionEn: "",
  name: "",
  nameEn: "",
  productCode: "",
  shortDescription: "",
  taxClass: "STANDARD",
};

export function productToDraftForm(product: Product): ProductDraftFormValues {
  return {
    brandId: product.brandId ?? "",
    categoryId: product.categoryId ?? "",
    customizable: product.type === "Customizable",
    description: product.description,
    descriptionEn: product.descriptionEn,
    name: product.name,
    nameEn: product.nameEn,
    productCode: product.code ?? product.productId,
    shortDescription: product.shortDescription ?? "",
    taxClass: product.taxClass.toUpperCase() as ProductDraftFormValues["taxClass"],
  };
}

/**
 * Payload BE PR #71 `CreateProductRequest`. Ảnh (theo biến thể) và kích thước / khối lượng (theo
 * SKU) không còn đi cùng sản phẩm — BE tạo sẵn một biến thể mặc định có SKU = mã sản phẩm.
 */
export function buildCreateProductInput(form: ProductCreateFormSnapshot): CreateProductInput {
  return {
    code: form.productCode.trim(),
    name: form.name.trim(),
    nameEn: form.nameEn.trim(),
    categoryId: form.categoryId.trim(),
    brandId: form.brandId.trim(),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    descriptionEn: form.descriptionEn.trim(),
    taxClass: form.taxClass,
    kind: form.customizable ? "CUSTOMIZABLE" : "STANDARD",
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
  if (error.code === "BRAND_NOT_FOUND" && !fieldErrors.brandId) {
    fieldErrors.brandId = "Thương hiệu đã bị xoá hoặc không còn khả dụng.";
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
    brandId: "Thương hiệu không hợp lệ.",
    categoryId: "Danh mục không hợp lệ.",
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
    case "kind":
      return "customizable";
    case "brandId":
    case "categoryId":
    case "customizable":
    case "description":
    case "descriptionEn":
    case "name":
    case "nameEn":
    case "shortDescription":
    case "taxClass":
      return field;
    default:
      return null;
  }
}
