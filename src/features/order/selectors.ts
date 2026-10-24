/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

import { ORDER_CANCELLATION_REASON_CODES, ORDER_CANCELLATION_REASON_LABELS } from "@/constants";
import { currencyFractionDigits } from "@/lib/format";

import type {
  CreditRejectionAction,
  OrderCancellationReasonCode,
  OrderPaymentTerm,
} from "@/constants";
import type { CreditHold, Order, OrderReadStatus, ProductionOrder } from "./types";

/**
 * Trạng thái cần người xử lý tay → gắn viền cảnh báo ở row (data-table-mode-a).
 * Ngoại lệ chờ nhân viên quyết: ON_HOLD (giữ đơn), DELIVERY_FAILED (giao thất bại — giao lại hoặc trả
 * về), PARTIALLY_FULFILLED (giao một phần — đóng phần còn lại hoặc chờ phần sau) và RETURN_REQUESTED
 * (khách yêu cầu trả hàng). Chốt với lead 22/10.
 */
const FLAGGED_STATUSES: readonly OrderReadStatus[] = [
  "On Hold",
  "Delivery Failed",
  "Partially Fulfilled",
  "Return Requested",
];

export function shouldFlagOrderRow(order: Pick<Order, "status">): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}

/* ── Thanh toán ──────────────────────────────────────────────────────── */

// Trạng thái cọc (docs 15 BR-02, docs 19 BR-09) — một định nghĩa, ở luật release của PR #74
export { depositState } from "./release-rules";
export type { DepositState } from "./release-rules";

export type CreditState = "not-applicable" | "on-hold" | "within-limit";

/**
 * Trạng thái công nợ — BE không có field riêng. Chờ duyệt vượt hạn mức ⇔ On Hold với lý do CREDIT
 * (BE `Order#submitOnCredit` + `holdReason`, PR #133). Đơn CREDIT bị giữ vì lý do khác (địa chỉ, thiết
 * kế, giữ tay) đã qua kiểm hạn mức lúc xác nhận → "within-limit". Số liệu vượt bao nhiêu: `creditHoldSummary`.
 */
export function creditState(
  order: Pick<Order, "paymentTerm" | "status" | "holdReason">,
): CreditState {
  if (order.paymentTerm !== "CREDIT") return "not-applicable";
  return order.status === "On Hold" && order.holdReason === "CREDIT" ? "on-hold" : "within-limit";
}

/** Phần vượt hạn mức: dư nợ + giá trị đơn − hạn mức (docs 14 BR-06). Không âm. */
export function creditOverage(hold: Pick<CreditHold, "creditLimit" | "exposure" | "orderAmount">) {
  return Math.max(0, hold.exposure + hold.orderAmount - hold.creditLimit);
}

/** Tình trạng công nợ mà số liệu lúc kiểm chứng minh được (xem `creditHoldSummary`). */
export type CreditHoldSummary = { kind: "over-limit"; excess: number } | { kind: "overdue" };

/**
 * Tình trạng công nợ của một đơn trong hàng đợi — KHÔNG phải lý do giữ BE đã lưu (outcome).
 * `CreditHoldResponse` (BE develop) CHƯA trả outcome —
 * chỉ có số liệu lúc kiểm (hạn mức, dư nợ, giá trị đơn). BE `OrderServiceImpl#submitOnCredit` xét
 * nợ quá hạn TRƯỚC (→ OVERDUE), rồi dư nợ + đơn > hạn mức (→ OVER_LIMIT); trong hạn mức → CONFIRMED,
 * không vào hàng đợi. Suy ra:
 * - phần vượt = 0 ⇒ chắc chắn OVERDUE (không thể giữ vì vượt hạn mức khi không vượt);
 * - phần vượt > 0 ⇒ chắc chắn đơn vượt hạn mức đúng số đó — nhưng KHÔNG chứng minh outcome là
 *   OVER_LIMIT (khách có thể đồng thời nợ quá hạn → BE lưu OVERDUE), nên chỉ nêu tình trạng.
 * So theo đơn vị nhỏ nhất của tiền tệ (BE `Money` làm tròn theo đó) để sai số số thực không biến
 * "vừa chạm hạn mức" thành "vượt 0,00".
 */
export function creditHoldSummary(
  hold: Pick<CreditHold, "creditLimit" | "exposure" | "orderAmount"> & {
    order: Pick<CreditHold["order"], "currency">;
  },
): CreditHoldSummary {
  const excess = creditOverage(hold);
  const minorUnits = Math.round(excess * 10 ** currencyFractionDigits(hold.order.currency));
  return minorUnits > 0 ? { kind: "over-limit", excess } : { kind: "overdue" };
}

/**
 * Cách xử lý từ chối chọn được với công nợ HIỆN TẠI của khách. Huỷ luôn được; chuyển sang trả
 * trước / đặt cọc chỉ khi `allowedTerms` của BE có phương thức đó (BE trả 409
 * PAYMENT_TERM_NOT_ALLOWED nếu không — docs 14 BR-05). Chưa có credit position (đang tải / lỗi /
 * thiếu quyền) → chỉ huỷ, không đoán phương thức. BE vẫn là nơi quyết định cuối.
 */
export function availableRefusalActions(
  allowedTerms: readonly OrderPaymentTerm[] | null,
): CreditRejectionAction[] {
  const actions: CreditRejectionAction[] = ["CANCEL"];
  if (allowedTerms?.includes("PREPAID")) actions.push("SWITCH_TO_PREPAID");
  if (allowedTerms?.includes("DEPOSIT")) actions.push("SWITCH_TO_DEPOSIT");
  return actions;
}

/* ── Lý do huỷ ───────────────────────────────────────────────────────── */

const isKnownReasonCode = (code: string): code is OrderCancellationReasonCode =>
  (ORDER_CANCELLATION_REASON_CODES as readonly string[]).includes(code);

/**
 * Tách cột lý do huỷ của BE (`Order#cancel`: `"CODE"` hoặc `"CODE: ghi chú"` — dùng cho cả
 * `cancellation.reason` lẫn lịch sử trạng thái) thành mã + ghi chú, như BE
 * `CancelOrderCommand.fromText`. `knownCode` (mã có cấu trúc `cancellation.reasonCode`) cho phép
 * tách cả mã BE mới FE chưa có nhãn. Lý do tự do kiểu cũ → không mã, cả chuỗi là ghi chú.
 */
export function parseCancellationReason(
  reason: string | null,
  knownCode?: string | null,
): { code: string | null; note: string | null } {
  const text = reason?.trim() ?? "";
  if (!text) return { code: null, note: null };
  const candidates = [...(knownCode ? [knownCode] : []), ...ORDER_CANCELLATION_REASON_CODES];
  for (const code of candidates) {
    if (text === code) return { code, note: null };
    if (text.startsWith(`${code}:`))
      return { code, note: text.slice(code.length + 1).trim() || null };
  }
  return { code: null, note: text };
}

/** Nhãn tiếng Việt của mã lý do huỷ; mã lạ (BE thêm mã mới) hiện nguyên mã, không để trống. */
export function cancellationReasonLabel(code: string): string {
  return isKnownReasonCode(code) ? ORDER_CANCELLATION_REASON_LABELS[code] : code;
}

/** Một dòng đọc được: "Khách yêu cầu — khách đổi ý" thay vì "CUSTOMER_REQUEST: khách đổi ý". */
export function formatCancellationReason(reason: string | null): string | null {
  const { code, note } = parseCancellationReason(reason);
  if (!code) return note;
  const label = cancellationReasonLabel(code);
  return note ? `${label} — ${note}` : label;
}

/**
 * Số tiền giữ lại xem trước khi huỷ — cùng cách BE `Order#cancel`: tiền đã thu × % / 100, làm tròn
 * HALF_UP theo số lẻ của tiền tệ (VND 0, USD 2). % giữ nguyên (gửi BE đúng số người nhập).
 */
export function retainedAmountPreview(paid: number, percent: number, currency: string): number {
  const factor = 10 ** currencyFractionDigits(currency);
  return Math.round(((paid * percent) / 100) * factor) / factor;
}

/* ── Dòng đơn & lệnh sản xuất ────────────────────────────────────────── */

export function customLineCount(order: Pick<Order, "lines">): number {
  return order.lines.filter((line) => line.isCustom).length;
}

export interface LineProductionOrders {
  /** LSX gốc của dòng (docs 19 BR-01: đúng 1). */
  parents: ProductionOrder[];
  /** LSX con tách gia công, theo `parentId` (docs 19 BR-12). */
  children: ProductionOrder[];
}

/** Gom LSX theo dòng đơn: gốc (`parentId` null) và con gia công trỏ về gốc của dòng đó. */
export function groupProductionOrdersByLine(
  productionOrders: readonly ProductionOrder[],
): Map<string, LineProductionOrders> {
  const byLine = new Map<string, LineProductionOrders>();
  for (const po of productionOrders) {
    const entry = byLine.get(po.salesOrderLineId) ?? { parents: [], children: [] };
    (po.parentId ? entry.children : entry.parents).push(po);
    byLine.set(po.salesOrderLineId, entry);
  }
  return byLine;
}

// Lý do chưa release biết trước (BR-PRD-09…): `release-rules.ts` (PR #74).

/* ── Huỷ đơn ──────────────────────────────────────────────────────────── */

/**
 * Hệ quả huỷ theo trạng thái — docs 17 §4.4–4.5, docs 19 BR-10, BE `Order#cancel` (PR #133).
 * Đơn On Hold: theo trạng thái đã bị giữ (`statusBeforeHold`) nếu biết. Packed / Partially Fulfilled
 * trở đi BE không cho huỷ (`requireNotPacked`, BR-ORD-004) → không có câu nào gợi ý huỷ được.
 */
export function cancelConsequence(
  status: OrderReadStatus,
  statusBeforeHold?: OrderReadStatus | null,
): string | null {
  const effective = status === "On Hold" && statusBeforeHold ? statusBeforeHold : status;
  switch (effective) {
    // BE PrintRunService#onOrderCancelled: LSX chưa in → huỷ; đang in / gia công ngoài → treo để xưởng
    // dừng việc, quản lý xử lý phôi + hàng đã in (BR-PRD-10). Form huỷ KHÔNG gửi retainedPercent /
    // agreedFee (OrderCancelForm) → không hứa phí sản xuất (docs 19 BR-10 chỉ áp dụng khi giữ phí).
    case "In Production":
      return "Đơn đang sản xuất: lệnh sản xuất chưa in sẽ được huỷ; lệnh đang in hoặc gia công ngoài sẽ được treo để xưởng xử lý phôi và hàng đã in. Thao tác huỷ này không áp dụng phí huỷ.";
    case "Ready to Fulfill":
      return "Đơn đã release cho kho nhưng chưa lấy hàng: huỷ sẽ nhả giữ chỗ tồn (docs 17 BR-03).";
    case "Picking":
      return "Kho đang lấy hàng: huỷ sẽ dừng lấy hàng và put-back hàng đã lấy về vị trí (docs 17 BR-03).";
    default:
      return null;
  }
}
