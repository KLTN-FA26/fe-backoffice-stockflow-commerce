/**
 * Vòng đời yêu cầu trả hàng và phiếu nhập hàng hoàn — chép BE `ReturnStatus.canTransitionTo` (docs 17 §4.10 không
 * có bảng trạng thái riêng cho RMA; code BE là nguồn đúng) và `GoodsReceiptStatus` của phiếu loại RETURN (03 §4.2).
 * UI-only — Backend phải re-check (quyền `sales-rmas`, `sales-rma-resolutions`, `procurement-goods-receipts`;
 * bốn mắt `RETURN_SELF_APPROVAL`).
 */

import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import {
  RETURN_OPEN_STATUSES,
  RMA_PERMISSIONS,
  RMA_RESOLUTION_PERMISSIONS,
} from "@/constants/returns";

import type { ReturnApiStatus, ReturnReceiptApiStatus } from "@/constants/returns";
import type { PermissionCode } from "@/lib/auth/me-permissions";

/**
 * BE `ReturnStatus.canTransitionTo`. Phiếu nhập mở trước khi hết hạn / bị rút vẫn đưa hàng về (EXPIRED / CANCELLED →
 * RECEIVED) — đó là việc của kho, không phải nút trên màn RMA. RESOLVED / REJECTED / INSPECTED là cuối.
 */
export const RETURN_TRANSITIONS: Readonly<Record<ReturnApiStatus, readonly ReturnApiStatus[]>> = {
  REQUESTED: ["AWAITING_RETURN", "REJECTED", "CANCELLED"],
  AWAITING_RETURN: ["RECEIVED", "CANCELLED", "EXPIRED"],
  RECEIVED: ["SETTLEMENT_PENDING"],
  SETTLEMENT_PENDING: ["RESOLVED", "RECEIVED"],
  EXPIRED: ["RECEIVED"],
  CANCELLED: ["RECEIVED"],
  INSPECTED: [],
  RESOLVED: [],
  REJECTED: [],
};

export type ReturnAction =
  | "approve"
  | "reject"
  | "cancel"
  | "createReceipt"
  | "propose"
  | "approveSettlement"
  | "rejectSettlement";

type Can = (code: PermissionCode) => boolean;

/** Mỗi hành động: trạng thái nguồn + quyền cần. */
const RULES: Readonly<
  Record<ReturnAction, { from: readonly ReturnApiStatus[]; needs: PermissionCode }>
> = {
  approve: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve },
  reject: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve },
  // Rút trước khi hàng về (BE `POST /returns/{id}/cancellation`)
  cancel: { from: ["REQUESTED", "AWAITING_RETURN"], needs: RMA_PERMISSIONS.update },
  // 17 BR-18: hàng của yêu cầu đã duyệt luôn về qua phiếu nhập hàng hoàn
  createReceipt: { from: ["AWAITING_RETURN"], needs: GOODS_RECEIPT_PERMISSIONS.create },
  propose: { from: ["RECEIVED"], needs: RMA_RESOLUTION_PERMISSIONS.propose },
  approveSettlement: {
    from: ["SETTLEMENT_PENDING"],
    needs: RMA_RESOLUTION_PERMISSIONS.approve,
  },
  rejectSettlement: { from: ["SETTLEMENT_PENDING"], needs: RMA_RESOLUTION_PERMISSIONS.approve },
};

const ORDER: readonly ReturnAction[] = [
  "approve",
  "reject",
  "createReceipt",
  "propose",
  "approveSettlement",
  "rejectSettlement",
  "cancel",
];

export function allowedReturnActions(ret: { status: ReturnApiStatus }, can: Can): ReturnAction[] {
  return ORDER.filter((action) => {
    const rule = RULES[action];
    return rule.from.includes(ret.status) && can(rule.needs);
  });
}

export function isReturnOpen(status: ReturnApiStatus): boolean {
  return (RETURN_OPEN_STATUSES as readonly ReturnApiStatus[]).includes(status);
}

/** Phiếu hàng hoàn: DRAFT → CLOSED (xác nhận) / CANCELLED; không qua duyệt, không putaway (BE `ReturnReceipt`). */
export const RETURN_RECEIPT_TRANSITIONS: Readonly<
  Record<ReturnReceiptApiStatus, readonly ReturnReceiptApiStatus[]>
> = {
  DRAFT: ["CLOSED", "CANCELLED"],
  PENDING_APPROVAL: [],
  CONFIRMED: [],
  IN_PUTAWAY: [],
  CLOSED: [],
  CANCELLED: [],
};

export type ReturnReceiptAction = "scan" | "remove" | "confirm" | "cancel";

export function allowedReturnReceiptActions(
  receipt: { status: ReturnReceiptApiStatus; cartons: readonly unknown[] },
  can: Can,
): ReturnReceiptAction[] {
  if (receipt.status !== "DRAFT" || !can(GOODS_RECEIPT_PERMISSIONS.update)) return [];
  // INVALID_RECEIPT_TRANSITION khi xác nhận phiếu chưa có thùng (BE `ReturnReceipt.confirm`)
  return receipt.cartons.length > 0 ? ["scan", "remove", "confirm", "cancel"] : ["scan", "cancel"];
}
