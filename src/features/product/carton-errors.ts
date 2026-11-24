/**
 * Lỗi BE của đơn vị tính / quy cách thùng (`SkuUnitService`, `UomConversionServiceImpl`,
 * `UomConversionRules`) → câu tiếng Việt, không lộ message tiếng Anh của BE.
 */
import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

const E = UI_LABELS.cartonSpec.error;
const V = UI_LABELS.cartonSpec.validation;

/** Field của BE `Create/UpdateUomConversionRequest` → [ô của form thùng, câu tiếng Việt]. */
const FORM_FIELD: Readonly<Record<string, readonly [string, string]>> = {
  unitOfMeasure: ["unitOfMeasure", V.unitOfMeasure],
  factor: ["unitsPerCarton", V.unitsPerCarton],
  lengthCm: ["lengthCm", V.size],
  widthCm: ["widthCm", V.size],
  heightCm: ["heightCm", V.size],
  weightKg: ["weightKg", V.weight],
  defaultShipping: ["defaultShipping", V.defaultShipping],
};

/** Lỗi tải danh sách đơn vị; `retryable` = thử lại có thể đổi kết quả. */
export function cartonLoadError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) return { message: E.forbidden, retryable: false };
    if (error.code === "INVENTORY_ITEM_NOT_FOUND") return { message: E.noItem, retryable: false };
    if (error.status === 404) return { message: E.notFound, retryable: false };
  }
  return { message: E.loadFailed, retryable: true };
}

/**
 * Mã cho thấy dữ liệu trên màn đã cũ → tải lại đơn vị + biến thể của sản phẩm: version lệch, đơn vị /
 * biến thể không còn, biến thể vừa ngừng, sản phẩm vừa chuyển sang chờ duyệt / ngừng kinh doanh.
 */
const STALE_CODES = new Set([
  "OPTIMISTIC_LOCK",
  "UOM_CONVERSION_NOT_FOUND",
  "VARIANT_OBSOLETE",
  "CONFLICT",
  "NOT_FOUND",
]);

export function isStaleCartonError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}

/** Lỗi lưu: theo ô (BE `fieldErrors`) hoặc một câu chung của dialog. */
export function cartonSaveError(error: unknown): {
  fields: Record<string, string>;
  message: string | null;
} {
  if (!(error instanceof ApiError)) return { fields: {}, message: E.unexpected };
  const known: Record<string, string> = {
    OPTIMISTIC_LOCK: E.versionConflict,
    UOM_CONVERSION_DUPLICATE: E.duplicate,
    // BE 409: biến thể đã có một thùng đang dùng (01 BR-03) — phải ngừng dùng thùng cũ trước.
    UOM_CARTON_ALREADY_DECLARED: E.cartonAlreadyDeclared,
    UOM_CONVERSION_IN_USE: E.inUse,
    UOM_CONVERSION_NOT_FOUND: E.unitGone,
    CARTONS_WOULD_NOT_FIT: E.wouldNotFit,
    CONFLICT: E.productLocked,
    VARIANT_OBSOLETE: E.variantObsolete,
    INVENTORY_ITEM_NOT_FOUND: E.noItem,
  };
  const message = known[error.code];
  if (message) {
    // Mã thùng đã có: báo ngay ở ô mã đơn vị
    return error.code === "UOM_CONVERSION_DUPLICATE"
      ? { fields: { unitOfMeasure: message }, message: null }
      : { fields: {}, message };
  }
  if (error.status === 403) return { fields: {}, message: E.forbidden };
  if (error.status === 404) return { fields: {}, message: E.notFound };
  if (error.code === "VALIDATION_FAILED" && error.fieldErrors) {
    const fields: Record<string, string> = {};
    let outside = false;
    for (const name of Object.keys(error.fieldErrors)) {
      const mapped = FORM_FIELD[name];
      if (mapped) fields[mapped[0]] = mapped[1];
      else outside = true;
    }
    return { fields, message: outside ? E.invalid : null };
  }
  if (error.status === 400) return { fields: {}, message: E.invalid };
  return { fields: {}, message: E.unexpected };
}

/** Lỗi ngưng dùng / xoá đơn vị: `UOM_CONVERSION_IN_USE` có nghĩa khác nhau theo thao tác. */
export function cartonUnitActionError(error: unknown, action: "retire" | "delete"): string {
  if (error instanceof ApiError && error.code === "UOM_CONVERSION_IN_USE") {
    return action === "retire" ? E.retireInUse : E.deleteInUse;
  }
  return cartonSaveError(error).message ?? E.unexpected;
}
