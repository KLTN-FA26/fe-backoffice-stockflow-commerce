/**
 * Phân loại lỗi của thông tin mua hàng (BE `SkuPurchasingService`, `ItemPurchasingServiceImpl`):
 * câu cho lỗi tải (GET) và các phép thử theo `ApiError.code` cho PUT.
 */
import { UI_LABELS } from "@/constants";
import { ApiError } from "@/lib/api/error";

const E = UI_LABELS.skuPurchasing.error;

/**
 * Lỗi tải `GET .../purchasing`: 403; 404 không có hồ sơ hàng tồn (khác "chưa khai báo" — đó là 200
 * với mọi field null); 404 sản phẩm / biến thể; còn lại (mạng, 5xx, sai hợp đồng) → "thử lại", không
 * bao giờ giả làm "chưa thiết lập". `retryable` = thử lại có thể đổi kết quả.
 */
export function purchasingLoadError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ApiError) {
    if (error.status === 403) return { message: E.forbidden, retryable: false };
    if (error.code === "INVENTORY_ITEM_NOT_FOUND") {
      return { message: E.noInventoryItem, retryable: false };
    }
    if (error.status === 404) return { message: E.notFound, retryable: false };
  }
  return { message: E.loadFailed, retryable: true };
}

/**
 * Lệch `version` của hồ sơ hàng tồn — có người vừa lưu logistics, chính sách tồn, thông tin mua hàng
 * hoặc đổi "NCC ưu tiên". Khác các 409 còn lại (`CONFLICT` sản phẩm đang duyệt / ngừng kinh doanh,
 * `VARIANT_OBSOLETE`, `SUPPLIER_INACTIVE`) vốn không sửa được bằng cách tải lại rồi lưu lần nữa.
 */
export function isPurchasingVersionConflict(error: unknown): boolean {
  return error instanceof ApiError && error.code === "OPTIMISTIC_LOCK";
}

/**
 * Mã cho thấy dữ liệu trên màn đã cũ → tải lại thông tin mua hàng + biến thể + sản phẩm:
 * OPTIMISTIC_LOCK (version), INVENTORY_ITEM_NOT_FOUND / NOT_FOUND / PRODUCT_NOT_FOUND (SKU, biến thể,
 * sản phẩm không còn), VARIANT_OBSOLETE (biến thể vừa ngừng), CONFLICT (sản phẩm vừa chuyển sang
 * chờ duyệt / ngừng kinh doanh — `SkuPurchasingService.describe`).
 */
const STALE_CODES = new Set([
  "OPTIMISTIC_LOCK",
  "INVENTORY_ITEM_NOT_FOUND",
  "NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "VARIANT_OBSOLETE",
  "CONFLICT",
]);

export function isStalePurchasingError(error: unknown): boolean {
  return error instanceof ApiError && STALE_CODES.has(error.code);
}

const S = UI_LABELS.skuPurchasing.saveError;
/** Field của BE `SkuPurchasingRequest` — trùng tên ô của form sửa. */
const FORM_FIELDS = new Set([
  "defaultSupplierId",
  "referencePurchasePrice",
  "referencePurchaseCurrency",
  "leadTimeDays",
  "moq",
]);

/** Kết quả lưu thất bại, đã phân loại cho form sửa. */
export type PurchasingSaveFailure =
  /** Lệch version — tải lại phải do người dùng bấm (bỏ bản nháp), không tự gửi lại. */
  | { kind: "versionConflict"; message: string }
  /** Lỗi theo ô (BE `fieldErrors`, hoặc NCC không tồn tại / ngừng hoạt động → ô NCC). */
  | { kind: "fields"; fields: Record<string, string>; message: string | null }
  /** Còn lại: luật nghiệp vụ (409 khác), 403, 404, 400 không theo ô, lỗi mạng / máy chủ. */
  | { kind: "message"; message: string };

/**
 * Lỗi PUT thông tin mua hàng (BE `SkuPurchasingService.describe`, `ItemPurchasingServiceImpl`,
 * `GlobalExceptionHandler`). 409 OPTIMISTIC_LOCK tách khỏi các 409 nghiệp vụ (`CONFLICT` sản phẩm
 * chờ duyệt / ngừng kinh doanh, `VARIANT_OBSOLETE`, `SUPPLIER_INACTIVE`) — tải lại không sửa được chúng.
 */
export function purchasingSaveFailure(error: unknown): PurchasingSaveFailure {
  if (!(error instanceof ApiError)) return { kind: "message", message: S.unexpected };
  if (error.code === "OPTIMISTIC_LOCK")
    return { kind: "versionConflict", message: S.versionConflict };
  if (error.code === "SUPPLIER_NOT_FOUND" || error.code === "SUPPLIER_INACTIVE") {
    return {
      kind: "fields",
      fields: { defaultSupplierId: S[error.code] },
      message: null,
    };
  }
  const known: Record<string, string> = {
    CONFLICT: S.productLocked,
    VARIANT_OBSOLETE: S.variantObsolete,
    INVENTORY_ITEM_NOT_FOUND: E.noInventoryItem,
    PRODUCT_NOT_FOUND: E.notFound,
    NOT_FOUND: E.notFound,
    MALFORMED_REQUEST: S.malformed,
  };
  const message = known[error.code];
  if (message) return { kind: "message", message };
  if (error.status === 403) return { kind: "message", message: S.forbidden };
  if (error.code === "VALIDATION_FAILED" && error.fieldErrors) {
    const fields = Object.fromEntries(
      Object.entries(error.fieldErrors).filter(([name]) => FORM_FIELDS.has(name)),
    );
    // Lỗi theo field không có ô (vd `version`) → câu chung của khối
    const outside = Object.keys(error.fieldErrors).some((name) => !FORM_FIELDS.has(name));
    return { kind: "fields", fields, message: outside ? S.invalid : null };
  }
  if (error.status === 400) return { kind: "message", message: S.invalid };
  return { kind: "message", message: S.unexpected };
}
