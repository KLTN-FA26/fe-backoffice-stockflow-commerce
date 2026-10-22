/**
 * Lỗi BE của kế hoạch xếp xe (PR #161) → câu tiếng Việt. Chỉ rẽ nhánh theo `errorCode` ổn định, không lộ message
 * tiếng Anh. Mã thật của BE (`ErrorCode`): `LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED` (BR-13), `PACKAGE_IN_LOAD_PLAN`,
 * `LOAD_PLAN_PACKAGE_TAKEN` (BR-09), `LOAD_PLAN_NEEDS_RECALCULATION`, `LOAD_PLAN_LOADING_STARTED` (BR-14),
 * `ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED` (LP-4), `LOAD_MANAGED_BY_PLAN`, `OPTIMISTIC_LOCK`…
 */

import {
  LOAD_PLAN_EDITOR_STALE_MESSAGES as EDITOR_STALE,
  LOAD_PLAN_ERROR_MESSAGES as MESSAGES,
  LOAD_PLAN_PARTIAL_SHIPMENT_ORDER,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

const NOT_ON_TRAY = "LOAD_PLAN_PACKAGE_NOT_ON_TRAY";

type KnownCode = Exclude<keyof typeof MESSAGES, "generic">;

const isKnownCode = (code: string): code is KnownCode =>
  code !== "generic" && Object.hasOwn(MESSAGES, code);

/** Số mọi đơn vi phạm LP-4: từ mảng `fieldErrors` nguyên dạng, dự phòng bản đồ (chỉ còn một đơn). */
function orderNumbersOf(error: ApiError): string[] {
  const listed = (error.fieldErrorList ?? [])
    .filter((entry) => entry.field === "orderNumber")
    .map((entry) => entry.message);
  const fallback = error.fieldErrors?.orderNumber;
  const orders = listed.length > 0 ? listed : fallback ? [fallback] : [];
  return [...new Set(orders)];
}

/** Mã lỗi theo trường (`fieldErrors[].code`) có trong lỗi không — BE gói lỗi kiểm tra theo kiện vào `VALIDATION_FAILED`. */
function hasFieldCode(error: ApiError, code: string): boolean {
  return (
    (error.fieldErrorList ?? []).some((entry) => entry.code === code) ||
    Object.values(error.fieldCodes ?? {}).includes(code)
  );
}

type EditorStaleCode = keyof typeof EDITOR_STALE;

/**
 * `PUT …/placements` không mô tả đúng kế hoạch (thiếu / thừa / trùng kiện hoặc xe — BE `LoadPlan.editPlacements`) gói trong
 * `VALIDATION_FAILED`: bản đang soạn đã cũ so với kế hoạch.
 */
const editorStaleCodeOf = (error: ApiError): EditorStaleCode | undefined =>
  error.code === "VALIDATION_FAILED"
    ? (Object.keys(EDITOR_STALE) as EditorStaleCode[]).find((code) => hasFieldCode(error, code))
    : undefined;

export function loadPlanErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  const editorStale = editorStaleCodeOf(error);
  if (editorStale) return EDITOR_STALE[editorStale];
  // `addPackageIds` có kiện không còn trên khay: BE từ chối cả request bằng VALIDATION_FAILED
  if (error.code === "VALIDATION_FAILED" && hasFieldCode(error, NOT_ON_TRAY))
    return MESSAGES.LOAD_PLAN_PACKAGE_NOT_ON_TRAY;
  // LP-4: BE trả MỖI đơn vi phạm một `fieldErrors[{field: "orderNumber"}]`
  if (error.code === "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED") {
    const orders = orderNumbersOf(error);
    return orders.length > 0
      ? LOAD_PLAN_PARTIAL_SHIPMENT_ORDER(orders)
      : MESSAGES.ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED;
  }
  if (isKnownCode(error.code)) return MESSAGES[error.code];
  if (error.status === 403) return MESSAGES.FORBIDDEN;
  return MESSAGES.generic;
}

/**
 * Dữ liệu trên màn đã cũ (người khác đổi, trạng thái đã khác, xe vừa bị bỏ kiện…) → mutation tải lại kế hoạch,
 * bố cục và đối chiếu để câu "đã tải lại" là thật và lần thử sau gửi đúng `expectedVersion`.
 */
const STALE_CODES: ReadonlySet<string> = new Set([
  "OPTIMISTIC_LOCK",
  "LOAD_PLAN_NOT_FOUND",
  "LOAD_PLAN_VEHICLE_NOT_FOUND",
  "INVALID_LOAD_PLAN_TRANSITION",
  "LOAD_PLAN_NEEDS_RECALCULATION",
  "LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED",
  "LOAD_PLAN_LOADING_STARTED",
  "LOAD_PLAN_PACKAGE_TAKEN",
  "SHIPMENT_STATE_CONFLICT",
]);

export function isStaleLoadPlanError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  // Kiện đã rời khay: khay trên màn đã cũ
  return (
    STALE_CODES.has(error.code) ||
    editorStaleCodeOf(error) !== undefined ||
    (error.code === "VALIDATION_FAILED" && hasFieldCode(error, NOT_ON_TRAY))
  );
}

/**
 * Câu cho lỗi tải dữ liệu đọc (danh sách lô, kế hoạch) khi BE trả mã đã biết hoặc 403 (kho ngoài phạm vi); `null` khi
 * lỗi lạ để màn dùng câu chung của nó.
 */
export function knownLoadPlanReadError(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  if (isKnownCode(error.code) && error.code !== "VALIDATION_FAILED") return MESSAGES[error.code];
  return error.status === 403 ? MESSAGES.OUT_OF_DATA_SCOPE : null;
}

/** 409 OPTIMISTIC_LOCK: màn phải tải lại rồi báo (mọi thay đổi gửi `expectedVersion`). */
export function isOptimisticLockError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "OPTIMISTIC_LOCK";
}
