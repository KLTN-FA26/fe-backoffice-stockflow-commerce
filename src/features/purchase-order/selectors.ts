/**
 * Purchase Order — selectors (pure derivations).
 *
 * Source: BE PurchaseOrder aggregate (open quantity semantics),
 * plus list-stats derived from BE 7-state.
 */

import { PO_CANCELLATION_DELIVERY_STATUS, PO_DELIVERY_STATUS, PO_STATUS } from "@/constants";
import { formatMoney } from "@/lib/format";

import { receiveGoodsLineInputSchema } from "./schemas";

import type { PurchaseOrder, PoLine, PoStatus } from "./types";

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
 * Dòng chưa có mô tả sản phẩm. BE #36 (9fbb90f) khi gửi NCC lấy mô tả của dòng, thiếu thì lấy tên
 * theo SKU trong danh mục; không có nữa → 400 `PO_LINE_DESCRIPTION_REQUIRED` và PO kẹt ở APPROVED.
 */
export function linesMissingDescription(po: Pick<PurchaseOrder, "lines">): PurchaseOrder["lines"] {
  return po.lines.filter((line) => !line.description?.trim());
}

/**
 * Đang gửi NCC — BE chưa có kết quả cuối (QUEUED: chờ worker, RETRYING: đang thử lại).
 * Màn chi tiết tự tải lại trong lúc này để không phải F5 (re-review PR #14, mục 3).
 */
export function isDeliveryInFlight(po: Pick<PurchaseOrder, "deliveryStatus"> | undefined): boolean {
  return (
    po?.deliveryStatus === PO_DELIVERY_STATUS.QUEUED ||
    po?.deliveryStatus === PO_DELIVERY_STATUS.RETRYING
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

/** Statuses that should flag a row in the list table. */
const FLAGGED_STATUSES: readonly PoStatus[] = [PO_STATUS.CANCELLED];

export function shouldFlagPoRow(po: PurchaseOrder): boolean {
  return FLAGGED_STATUSES.includes(po.status);
}

/* ── Receive goods draft ─────────────────────────────────────────────── */

export interface ReceiveDraftResult {
  /** Valid lines, ready for POST /receipts. */
  lines: { lineId: string; quantity: number }[];
  /** Inline error per lineId. */
  errors: Record<string, string>;
}

/**
 * Validate the "Nhận hàng" form before it reaches the BE.
 *
 * BR-04 (docs 02 §6): tổng SL nhận của một dòng ≤ SL đặt × (1 + dung sai nhận vượt).
 * ASSUMPTION (open-question C9): dung sai chưa chốt/chưa có cấu hình — BE `PoLine#receive`
 * đang dùng dung sai = 0 (qty ≤ openQuantity), FE mirror đúng giới hạn đó.
 * Vi phạm ở BE là IllegalArgumentException → 400 chung không có field, nên FE phải tự báo lý do.
 * Empty inputs are skipped (not every line has to be received in one go).
 */
export function validateReceiveDraft(
  poLines: readonly PoLine[],
  draft: Readonly<Record<string, string>>,
): ReceiveDraftResult {
  const result: ReceiveDraftResult = { lines: [], errors: {} };
  for (const line of poLines) {
    const raw = (draft[line.lineId] ?? "").trim();
    if (raw === "") continue;
    const parsed = receiveGoodsLineInputSchema.shape.quantity.safeParse(Number(raw));
    if (!parsed.success) {
      result.errors[line.lineId] = parsed.error.issues[0]?.message ?? "SL nhận không hợp lệ";
      continue;
    }
    const quantity = parsed.data;
    if (quantity > line.openQuantity) {
      result.errors[line.lineId] = `Vượt SL còn nhận được (${line.openQuantity})`;
    } else {
      result.lines.push({ lineId: line.lineId, quantity });
    }
  }
  return result;
}
