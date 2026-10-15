/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

import { currencyFractionDigits } from "@/lib/format";

import type { CreditRejectionAction, OrderPaymentTerm } from "@/constants";
import type { CreditHold, Order, OrderReadStatus, ProductionOrder } from "./types";

/**
 * Trạng thái cần người xử lý tay → gắn viền cảnh báo ở row (data-table-mode-a).
 * Trong các trạng thái BE chỉ ON_HOLD là "đang chờ xử lý ngoại lệ".
 */
const FLAGGED_STATUSES: readonly OrderReadStatus[] = ["On Hold"];

export function shouldFlagOrderRow(order: Pick<Order, "status">): boolean {
  return FLAGGED_STATUSES.includes(order.status);
}

/* ── Thanh toán ──────────────────────────────────────────────────────── */

export type DepositState = "not-applicable" | "awaiting" | "received";

/**
 * Trạng thái cọc — BE không có enum riêng, suy từ `paymentTerm` + `depositReceivedAt`
 * (docs 15 BR-02: đơn cọc chỉ Confirmed khi đủ cọc; docs 19 BR-09 chặn release khi chưa đủ).
 */
export function depositState(
  order: Pick<Order, "paymentTerm" | "depositReceivedAt">,
): DepositState {
  if (order.paymentTerm !== "DEPOSIT") return "not-applicable";
  return order.depositReceivedAt ? "received" : "awaiting";
}

export type CreditState = "not-applicable" | "on-hold" | "within-limit";

/**
 * Trạng thái công nợ — BE không có field riêng. Đơn CREDIT ở On Hold = đang tạm giữ; `OrderResponse`
 * KHÔNG cho biết vì sao (vượt hạn mức, nợ quá hạn, hay giữ vì lý do khác) → không suy ra nguyên nhân
 * từ đây (xem `creditHoldSummary`). Đơn CREDIT trạng thái khác đã qua kiểm hạn mức.
 */
export function creditState(order: Pick<Order, "paymentTerm" | "status">): CreditState {
  if (order.paymentTerm !== "CREDIT") return "not-applicable";
  return order.status === "On Hold" ? "on-hold" : "within-limit";
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

/* ── Release (SCRUM-423) ─────────────────────────────────────────────── */

export interface ReleaseBlocker {
  /** Mã BR để đối chiếu docs. */
  rule: string;
  message: string;
}

/**
 * Lý do CHẮC CHẮN chưa release được, suy từ dữ liệu đơn — hiện trước để Coordinator không phải
 * bấm thử. BR-PRD-08 (mẫu duyệt) và công nợ quá hạn FE không biết trước → chỉ BE báo khi release.
 */
export function releaseBlockers(
  order: Pick<Order, "status" | "paymentTerm" | "depositReceivedAt">,
): ReleaseBlocker[] {
  const blockers: ReleaseBlocker[] = [];
  // docs 19 BR-09 / BE ORDER_DEPOSIT_NOT_RECEIVED: đơn cọc chưa đủ cọc
  if (order.status === "Pending Payment" && depositState(order) === "awaiting") {
    blockers.push({ rule: "BR-PRD-09", message: "Đơn đặt cọc chưa nhận đủ tiền cọc." });
  }
  // docs 17 BR-02 / docs 14 BR-06: đơn công nợ đang tạm giữ chưa được duyệt. Đơn không mang lý do
  // giữ (vượt hạn mức / nợ quá hạn) → không nêu nguyên nhân cụ thể.
  if (order.status === "On Hold" && order.paymentTerm === "CREDIT") {
    blockers.push({ rule: "BR-02", message: "Đơn công nợ đang tạm giữ, chưa được duyệt." });
  }
  return blockers;
}

/* ── Huỷ đơn ──────────────────────────────────────────────────────────── */

/** Hệ quả huỷ theo trạng thái — docs 17 §4.4–4.5, docs 19 BR-10. */
export function cancelConsequence(status: OrderReadStatus): string | null {
  if (status === "In Production") {
    return "Đơn đang sản xuất: lệnh chưa in sẽ huỷ và trả phôi về kho; lệnh đã in tính phí sản xuất (docs 19 BR-10).";
  }
  if (status === "Ready to Fulfill" || status === "In Fulfilment") {
    return "Đơn đã giao kho: huỷ sẽ dừng lấy hàng và put-back hàng đã lấy (docs 17 BR-03).";
  }
  return null;
}
