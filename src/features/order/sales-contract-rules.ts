/**
 * Hợp đồng — vòng đời + kiểm tra thuần (docs 14 §4.3, §5; BE `SalesContractStatus`, origin/develop 438fe6fb):
 *   (chưa có / CANCELLED) + đơn DRAFT → lập; DRAFT → sửa, gửi, huỷ; SENT → ghi nhận đã ký, huỷ;
 *   SIGNED / COMPLETED: chỉ xem, tải bản đã gửi / đã ký. Huỷ đưa đơn về DRAFT để lập lại.
 * UI-only — Backend phải re-check (quyền sales-contracts CREATE / UPDATE / APPROVE).
 */

import { SALES_CONTRACT_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ContractFormValues } from "./sales-contract-form";
import type { SalesContract } from "./sales-contract-schemas";
import type { Order } from "./types";

export type ContractAction = "create" | "edit" | "send" | "sign" | "cancel" | "preview";

export const CONTRACT_TRANSITIONS = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["SIGNED", "CANCELLED"],
  SIGNED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
} as const satisfies Record<SalesContract["status"], readonly SalesContract["status"][]>;

export function allowedContractActions(
  contract: Pick<SalesContract, "status"> | null,
  orderStatus: Order["status"],
  can: (code: PermissionCode) => boolean,
): ContractAction[] {
  const status = contract?.status ?? null;
  const actions: ContractAction[] = [];
  if (
    (status === null || status === "CANCELLED") &&
    orderStatus === "Draft" &&
    can(SALES_CONTRACT_PERMISSIONS.create)
  )
    actions.push("create");
  if (status === "DRAFT" && can(SALES_CONTRACT_PERMISSIONS.update))
    actions.push("edit", "send", "cancel");
  if (status === "DRAFT") actions.push("preview");
  if (status === "SENT" && can(SALES_CONTRACT_PERMISSIONS.approve)) actions.push("sign");
  if (status === "SENT" && can(SALES_CONTRACT_PERMISSIONS.update)) actions.push("cancel");
  return actions;
}

export interface CartonGap {
  orderLineId: string;
  sku: string;
  ordered: number;
  scheduled: number;
  /** scheduled − ordered: âm = còn thiếu, dương = dư. */
  diff: number;
}

/** F-04.2: với mỗi dòng đơn, Σ thùng các đợt giao phải bằng số thùng của dòng. */
export function cartonGaps(
  lines: readonly Pick<Order["lines"][number], "lineId" | "sku" | "cartons">[],
  schedule: ContractFormValues["deliverySchedule"],
): CartonGap[] {
  return lines.map((line) => {
    const scheduled = schedule.reduce(
      (sum, batch) =>
        sum +
        (Number(batch.lines.find((entry) => entry.orderLineId === line.lineId)?.cartons) || 0),
      0,
    );
    const ordered = line.cartons ?? 0;
    return {
      orderLineId: line.lineId,
      sku: line.sku,
      ordered,
      scheduled,
      diff: scheduled - ordered,
    };
  });
}

/** Tổng các đợt thanh toán quy ra tiền (xem trước; % quy theo tổng có thuế, phần lẻ BE dồn đợt cuối). */
export function planTotal(plan: ContractFormValues["paymentPlan"], totalWithTax: number): number {
  return plan.reduce((sum, entry) => {
    const value = Number(entry.value) || 0;
    return sum + (entry.mode === "percent" ? Math.round((totalWithTax * value) / 100) : value);
  }, 0);
}

/** Thông báo cảnh báo tín dụng (15 BR-11) theo `outcome` của BE. */
export function creditWarningText(
  warning: NonNullable<SalesContract["creditWarning"]>,
  format: (amount: number) => string,
): string {
  if (warning.outcome === "OVERDUE")
    return "Khách đang có khoản quá hạn. Nếu vẫn gửi và khách ký, đơn sẽ bị treo chờ Kế toán duyệt tín dụng.";
  return `Phần trả sau giao (${format(warning.afterDelivery ?? 0)}) cộng dư nợ hiện tại (${format(warning.exposure ?? 0)}) vượt hạn mức (${format(warning.creditLimit ?? 0)}). Đơn sẽ bị treo khi ký.`;
}

const FIELD_NAMES: Readonly<Record<string, string>> = {
  windowStart: "Từ ngày",
  windowEnd: "Đến ngày",
  cartons: "Số thùng",
  amount: "Số tiền",
  percent: "Tỷ lệ %",
  name: "Tên đợt",
  milestone: "Mốc",
  dueDays: "Số ngày",
  deliveryBatchSeq: "Đợt giao gắn kèm",
};

/**
 * Tên dễ đọc của một `fieldErrors[].field` hợp đồng của BE (plan §1.2): `deliverySchedule[1].windowStart` → "Đợt giao 2
 * · Từ ngày", `paymentPlan[0].amount` → "Đợt thanh toán 1 · Số tiền", `deliverySchedule` → "Lịch giao". Trường lạ giữ
 * nguyên tên BE.
 */
export function contractFieldLabel(field: string): string {
  if (field === "deliverySchedule") return "Lịch giao";
  if (field === "paymentPlan") return "Lịch thanh toán";
  const batchLine = /^deliverySchedule\[(\d+)\]\.lines\[(\d+)\]\.(\w+)$/.exec(field);
  if (batchLine)
    return `Đợt giao ${Number(batchLine[1]) + 1} · dòng ${Number(batchLine[2]) + 1} · ${FIELD_NAMES[batchLine[3]!] ?? batchLine[3]}`;
  const entry = /^(deliverySchedule|paymentPlan)\[(\d+)\](?:\.(\w+))?$/.exec(field);
  if (entry) {
    const head = `${entry[1] === "deliverySchedule" ? "Đợt giao" : "Đợt thanh toán"} ${Number(entry[2]) + 1}`;
    return entry[3] ? `${head} · ${FIELD_NAMES[entry[3]] ?? entry[3]}` : head;
  }
  return field;
}

/** Kết quả sau khi ký (F-04.3) theo trạng thái đơn đọc lại. */
export function signOutcomeText(order: Pick<Order, "status" | "holdReason">): string | null {
  if (order.status === "Pending Payment")
    return "Đã ký. Đơn chờ thanh toán đợt khi ký (chưa giữ hàng).";
  if (order.status === "Confirmed") return "Đã ký. Đơn đã xác nhận.";
  if (order.status === "On Hold" && order.holdReason === "CREDIT")
    return "Đã ký. Đơn đang chờ Kế toán duyệt tín dụng.";
  return null;
}
