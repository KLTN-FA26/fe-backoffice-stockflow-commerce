/**
 * Lỗi BE của kế hoạch xếp xe (PR #161) → câu tiếng Việt. Chỉ rẽ nhánh theo `errorCode` ổn định, không lộ message
 * tiếng Anh. Mã thật của BE (`ErrorCode`): `LOAD_PLAN_UNPLACED_NOT_ACKNOWLEDGED` (BR-13), `PACKAGE_IN_LOAD_PLAN`,
 * `LOAD_PLAN_PACKAGE_TAKEN` (BR-09), `LOAD_PLAN_NEEDS_RECALCULATION`, `LOAD_PLAN_LOADING_STARTED` (BR-14),
 * `ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED` (LP-4), `LOAD_MANAGED_BY_PLAN`, `OPTIMISTIC_LOCK`…
 */

import {
  LOAD_PLAN_ERROR_MESSAGES as MESSAGES,
  LOAD_PLAN_PARTIAL_SHIPMENT_ORDER,
} from "@/constants";
import { ApiError } from "@/lib/api/error";

type KnownCode = Exclude<keyof typeof MESSAGES, "generic">;

const isKnownCode = (code: string): code is KnownCode =>
  code !== "generic" && Object.hasOwn(MESSAGES, code);

export function loadPlanErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return MESSAGES.generic;
  // LP-4: BE nêu số đơn vi phạm trong `fieldErrors.orderNumber`
  if (error.code === "ORDER_PARTIAL_SHIPMENT_NOT_ALLOWED") {
    const orders = error.fieldErrors?.orderNumber;
    return orders
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
  return error instanceof ApiError && STALE_CODES.has(error.code);
}

/** 409 OPTIMISTIC_LOCK: màn phải tải lại rồi báo (mọi thay đổi gửi `expectedVersion`). */
export function isOptimisticLockError(error: unknown): boolean {
  return error instanceof ApiError && error.code === "OPTIMISTIC_LOCK";
}
