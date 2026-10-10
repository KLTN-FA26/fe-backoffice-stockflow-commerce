/**
 * Purchase Order — selectors (pure derivations).
 *
 * Source: BE PurchaseOrder aggregate (open quantity semantics),
 * plus list-stats derived from BE 7-state.
 */

import {
  PO_CANCELLATION_DELIVERY_STATUS,
  PO_DELIVERY_STATUS,
  PO_STATUS,
  SUPPLIER_CONFIRMATION_STATUS,
} from "@/constants";
import { formatMoney } from "@/lib/format";

import type { PurchaseOrder, PoLine } from "./types";

export { formatMoney };

/** BE `POLineResponse.openQuantity` — the BE is the source of truth, never recomputed here. */
export function openQuantity(line: PoLine): number {
  return line.openQuantity;
}

export function totalOpenQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + openQuantity(line), 0);
}

export function totalOrderedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.orderedQty, 0);
}

export function totalReceivedQuantity(po: PurchaseOrder): number {
  return po.lines.reduce((sum, line) => sum + line.receivedQty, 0);
}

/**
 * BR-06 (docs 02 §6): ngày giao dự kiến đã qua → chỉ CẢNH BÁO, không chặn.
 * So với HÔM NAY theo Asia/Ho_Chi_Minh (`today` = `toLocalIsoDate(now)`), không so với ngày đặt.
 */
export function isExpectedDatePast(expectedDate: string, today: string): boolean {
  return expectedDate !== "" && expectedDate < today;
}

/** Gợi ý ngày giao = hôm nay + `leadTimeDays` của NCC (BE SupplierResponse.leadTimeDays). */
export function suggestExpectedDate(today: string, leadTimeDays: number): string {
  const [y = 0, m = 1, d = 1] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + leadTimeDays));
  return date.toISOString().slice(0, 10);
}

/**
 * Lượt gửi NCC. BE đánh `generation` từ 0: gửi lần đầu = 0, mỗi lần khôi phục gửi +1
 * (BE `NotificationServiceImpl.prepareSupplierDelivery`, `po_delivery_control.generation DEFAULT 0`).
 */
export function isFirstDelivery(generation: number): boolean {
  return generation === 0;
}

/** Số lượt hiển thị cho người dùng, đếm từ 1. */
export function deliveryRound(generation: number): number {
  return generation + 1;
}

/**
 * `failure` của lần gửi BE có dạng `"purchase-order:<uuid>: <TênException>"`
 * (BE `DeliveryAttemptRecorder.failed`) — chỉ giữ tên lỗi, không lộ UUID ra UI.
 */
export function deliveryFailureName(failure: string | null | undefined): string | null {
  if (!failure) return null;
  const name = failure.slice(failure.lastIndexOf(":") + 1).trim();
  return name || null;
}

/**
 * Lần gửi gần nhất chưa tới được NCC: BE `deliveryStatus` RETRYING (đang thử lại) hoặc FAILED
 * (hết lượt thử — người có quyền duyệt khôi phục được). Dùng cho cảnh báo + toast sau khi gửi.
 */
export function isDeliveryFailing(po: Pick<PurchaseOrder, "deliveryStatus">): boolean {
  return (
    po.deliveryStatus === PO_DELIVERY_STATUS.FAILED ||
    po.deliveryStatus === PO_DELIVERY_STATUS.RETRYING
  );
}

/**
 * Cảnh báo thẻ Gửi NCC. BE chỉ cho khôi phục khi PO CONFIRMED, NCC chưa phản hồi và lần gửi thất bại
 * hẳn (`requireDeliveryRecovery` + `prepareSupplierDelivery`); RETRYING = BE đang tự gửi lại.
 */
export function deliveryAlert(po: PoGateState): "recoverable" | "retrying" | null {
  if (po.status !== PO_STATUS.CONFIRMED) return null;
  if (po.deliveryStatus === PO_DELIVERY_STATUS.RETRYING) return "retrying";
  const pending = po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.PENDING;
  return pending && po.deliveryStatus === PO_DELIVERY_STATUS.FAILED ? "recoverable" : null;
}

/**
 * Dòng chưa có mô tả sản phẩm. BE #36 (9fbb90f) khi gửi NCC lấy mô tả của dòng, thiếu thì lấy tên
 * theo SKU trong danh mục; không có nữa → 400 `PO_LINE_DESCRIPTION_REQUIRED` và PO kẹt ở APPROVED.
 */
export function linesMissingDescription(po: Pick<PurchaseOrder, "lines">): PurchaseOrder["lines"] {
  return po.lines.filter((line) => !line.description?.trim());
}

const IN_FLIGHT: readonly string[] = [PO_DELIVERY_STATUS.QUEUED, PO_DELIVERY_STATUS.RETRYING];

/**
 * Đang gửi thư tới NCC — BE chưa có kết quả cuối (QUEUED: chờ worker, RETRYING: đang thử lại),
 * cho thư gửi đơn (`deliveryStatus`) lẫn thư báo huỷ (`cancellationDeliveryStatus`, BE #36).
 * Màn chi tiết tự tải lại trong lúc này để không phải F5 (re-review PR #14, mục 3).
 */
export function isDeliveryInFlight(
  po: Pick<PurchaseOrder, "deliveryStatus" | "cancellationDeliveryStatus"> | undefined,
): boolean {
  if (!po) return false;
  return (
    IN_FLIGHT.includes(po.deliveryStatus) ||
    (!!po.cancellationDeliveryStatus && IN_FLIGHT.includes(po.cancellationDeliveryStatus))
  );
}

/** BE cảnh báo ngày giao đã qua (`warnings` có DELIVERY_DATE_IN_PAST — BR-06, chỉ cảnh báo). */
export function hasDeliveryDateWarning(po: Pick<PurchaseOrder, "warnings">): boolean {
  return po.warnings.includes("DELIVERY_DATE_IN_PAST");
}

/** Thông báo huỷ tới NCC có cần hiện không (PO đã gửi rồi mới huỷ). */
export function showsCancellationNotice(
  po: Pick<PurchaseOrder, "status" | "cancellationDeliveryStatus">,
): boolean {
  return (
    po.status === PO_STATUS.CANCELLED &&
    po.cancellationDeliveryStatus !== undefined &&
    po.cancellationDeliveryStatus !== PO_CANCELLATION_DELIVERY_STATUS.NOT_REQUIRED
  );
}

export type PoAttentionReason = "deliveryFailed" | "supplierRejected";
type PoGateState = Pick<PurchaseOrder, "status" | "deliveryStatus" | "supplierConfirmationStatus">;

/**
 * Đơn cần xử lý (danh sách) — chỉ khi PO đang CONFIRMED (đã gửi NCC): gửi thất bại hẳn → khôi phục; NCC từ chối →
 * huỷ, tạo đơn mới. Đơn đã huỷ/đóng là kết thúc, không cần chú ý (data-table-mode-a §1).
 */
export function poAttentionReason(po: PoGateState): PoAttentionReason | null {
  if (po.status !== PO_STATUS.CONFIRMED) return null;
  if (po.supplierConfirmationStatus === SUPPLIER_CONFIRMATION_STATUS.REJECTED) {
    return "supplierRejected";
  }
  if (po.deliveryStatus === PO_DELIVERY_STATUS.FAILED) return "deliveryFailed";
  return null;
}

export function shouldFlagPoRow(po: PurchaseOrder): boolean {
  return poAttentionReason(po) !== null;
}
