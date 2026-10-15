/**
 * Order — selectors (pure derivations). PURE — không side effect, không import icon.
 */

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
 * Trạng thái công nợ — BE không có field riêng: đơn CREDIT ở On Hold = đang chờ duyệt vượt hạn
 * mức (docs 14 BR-06, SCRUM-427); đơn CREDIT trạng thái khác đã qua kiểm hạn mức.
 */
export function creditState(order: Pick<Order, "paymentTerm" | "status">): CreditState {
  if (order.paymentTerm !== "CREDIT") return "not-applicable";
  return order.status === "On Hold" ? "on-hold" : "within-limit";
}

/** Phần vượt hạn mức: dư nợ + giá trị đơn − hạn mức (docs 14 BR-06). Không âm. */
export function creditOverage(hold: Pick<CreditHold, "creditLimit" | "exposure" | "orderAmount">) {
  return Math.max(0, hold.exposure + hold.orderAmount - hold.creditLimit);
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
  // docs 17 BR-02 / docs 14 BR-06: công nợ vượt hạn mức chưa được duyệt
  if (order.status === "On Hold" && order.paymentTerm === "CREDIT") {
    blockers.push({ rule: "BR-02", message: "Đơn công nợ vượt hạn mức đang chờ duyệt." });
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
