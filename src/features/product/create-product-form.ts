import { PRODUCT_STATUS } from "@/constants";
import { ApiError } from "@/lib/api";

import { toAxisInputs } from "./axes-draft";
import { attributeErrorMessage } from "./attribute-errors";

import type { AxisDraft } from "./axes-draft";
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
export function buildCreateProductInput(
  form: ProductCreateFormSnapshot,
  axes: readonly AxisDraft[] = [],
): CreateProductInput {
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
    // Chỉ gửi khi có trục — không có thì BE tạo một biến thể mặc định (SKU = mã sản phẩm).
    ...(axes.length > 0 ? { axes: toAxisInputs(axes) } : {}),
  };
}

/** BE 409 OPTIMISTIC_LOCK: sản phẩm đã bị người khác sửa kể từ lần tải trang. */
export const PRODUCT_STALE_MESSAGE =
  "Dữ liệu đã bị người khác sửa. Biểu mẫu đã được tải lại với bản mới nhất, hãy kiểm tra rồi lưu lại.";

/** Lỗi tạo sản phẩm kèm trục mà BE từ chối cả giao dịch (không để lại sản phẩm nào). */
const AXES_ERROR_CODES = new Set([
  "VARIANT_MATRIX_TOO_LARGE",
  "VARIANT_OPTIONS_INVALID",
  "ATTRIBUTE_NOT_FOUND",
]);

export function mapCreateProductError(
  error: ApiError,
  hasAxes = false,
): {
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
  if (error.code === "OPTIMISTIC_LOCK") {
    return {
      fieldErrors,
      message: PRODUCT_STALE_MESSAGE,
    };
  }
  // BE `ProductServiceImpl.create`: không trục → SKU mặc định = mã sản phẩm, trùng với SKU của sản phẩm khác.
  if (error.code === "VARIANT_SKU_ALREADY_EXISTS" && !hasAxes) {
    fieldErrors.productCode = "Mã này đã là SKU của một biến thể thuộc sản phẩm khác.";
    return { fieldErrors, message: "Mã sản phẩm trùng với một SKU đã có." };
  }
  if (
    hasAxes &&
    (AXES_ERROR_CODES.has(error.code) || error.code === "VARIANT_SKU_ALREADY_EXISTS")
  ) {
    return {
      fieldErrors,
      message: `${attributeErrorMessage(error, "generate")} Sản phẩm chưa được tạo.`,
    };
  }
  // SKU hoặc tên sinh tự động vượt độ dài (BE `SkuCodeRule` / tên biến thể) — không có trường lỗi riêng.
  if (hasAxes && error.code === "VALIDATION_FAILED" && Object.keys(fieldErrors).length === 0) {
    return {
      fieldErrors,
      message:
        "Không tạo được ma trận biến thể: SKU hoặc tên sinh ra quá dài (SKU tối đa 64 ký tự). Rút ngắn mã sản phẩm hoặc mã giá trị. Sản phẩm chưa được tạo.",
    };
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
