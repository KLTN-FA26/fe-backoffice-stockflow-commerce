/** Selector thuần cho LSX — số liệu suy ra từ field BE, không bịa. */

import { PRODUCTION_STATUS_BY_API } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/domain/status-map";

import type { ProductionApiStatus } from "@/constants";
import type { HoldReason, ProductionDetail, ProductionRow, QcRound, ScrapReason } from "./types";

export const HOLD_REASON_LABEL: Readonly<Record<HoldReason, string>> = {
  FILE_REJECTED: "File in bị từ chối",
  BLANKS_SHORT: "Thiếu phôi",
  MACHINE_DOWN: "Máy hỏng",
  WAITING_CUSTOMER: "Chờ khách",
  SUBCONTRACTOR_LATE: "Nhà gia công trễ",
  OTHER: "Lý do khác",
};

export const SCRAP_REASON_LABEL: Readonly<Record<ScrapReason, string>> = {
  PRINT_DEFECT: "Lỗi in",
  DAMAGED_BLANK: "Phôi hỏng",
  QC_FAILED: "Không đạt QC",
  SETUP: "Canh chỉnh máy",
  OTHER: "Khác",
};

export function productionStatusLabel(status: ProductionApiStatus | string): string {
  const key = PRODUCTION_STATUS_BY_API[status as ProductionApiStatus] ?? status;
  return STATUS_LABEL_VI[key] ?? key;
}

const isStatus = (value: string | null | undefined): value is ProductionApiStatus =>
  !!value && value in PRODUCTION_STATUS_BY_API;

/** ON_HOLD → trạng thái trước khi treo (từ lịch sử BE); trạng thái khác → chính nó. */
export function effectiveStatus(
  order: Pick<ProductionDetail, "summary" | "history">,
): ProductionApiStatus | null {
  if (order.summary.status !== "ON_HOLD") return order.summary.status;
  const hold = [...order.history].reverse().find((change) => change.toStatus === "ON_HOLD");
  return isStatus(hold?.fromStatus) ? hold.fromStatus : null;
}

/** Phôi đã xuất còn chưa in = giới hạn SL in của lần ghi sản lượng (BE: printed ≤ issued − printed). */
export function printableBlanks(
  order: Pick<ProductionDetail, "issuedQuantity" | "printedQuantity">,
): number {
  return Math.max(0, order.issuedQuantity - order.printedQuantity);
}

/** Chờ QC = good − Σ passed (BE không trả trực tiếp). */
export function awaitingQc(
  order: Pick<ProductionDetail, "summary">,
  rounds: readonly QcRound[],
): number {
  return Math.max(
    0,
    order.summary.goodQuantity - rounds.reduce((sum, round) => sum + round.passed, 0),
  );
}

/** Phôi còn cần = planned − good − (issued − printed). */
export function blanksStillNeeded(
  order: Pick<ProductionDetail, "summary" | "issuedQuantity" | "printedQuantity">,
): number {
  return Math.max(
    0,
    order.summary.plannedQuantity -
      order.summary.goodQuantity -
      (order.issuedQuantity - order.printedQuantity),
  );
}

export function isOverdue(row: Pick<ProductionRow, "dueDate" | "status">, today: string): boolean {
  return !!row.dueDate && row.dueDate < today && !["COMPLETED", "CANCELLED"].includes(row.status);
}

export function todayVn(now = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Ho_Chi_Minh" });
}
