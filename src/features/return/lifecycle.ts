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

import { hasGoodsBack, totalRefundableUnits } from "./selectors";

import type { ReturnApiStatus, ReturnReceiptApiStatus } from "@/constants/returns";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ReturnRequest } from "./types";

/**
 * BE `ReturnStatus.canTransitionTo`. Phiếu nhập mở trước khi hết hạn / bị rút vẫn đưa hàng về (EXPIRED / CANCELLED →
 * RECEIVED) — đó là việc của kho, không phải nút trên màn RMA. RESOLVED / REJECTED / INSPECTED là cuối.
 */
export const RETURN_TRANSITIONS: Readonly<Record<ReturnApiStatus, readonly ReturnApiStatus[]>> = {
  REQUESTED: ["AWAITING_RETURN", "REJECTED", "CANCELLED"],
  AWAITING_RETURN: ["RECEIVED", "CANCELLED", "EXPIRED"],
  // WF-05 TH-4: không còn đơn vị nào hoàn được → kết thúc không hoàn tiền (BE `closeWithoutRefund`)
  RECEIVED: ["SETTLEMENT_PENDING", "RESOLVED"],
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
  | "goodsComplete"
  | "propose"
  | "closeWithoutRefund"
  | "approveSettlement"
  | "rejectSettlement";

type Can = (code: PermissionCode) => boolean;

/**
 * Phần của yêu cầu mà nút cần: trạng thái, hàng đã về (`receipt`) và các dòng (số hoàn được). `receipt` / `lines` vắng
 * mặt = chưa có hàng về, không đơn vị nào hoàn được.
 */
export type ReturnGateInput = Pick<ReturnRequest, "status"> &
  Partial<Pick<ReturnRequest, "receipt" | "lines">>;

interface ReturnRule {
  from: readonly ReturnApiStatus[];
  needs: PermissionCode;
  /** Điều kiện thêm trên dữ liệu của yêu cầu (ngoài trạng thái + quyền). */
  when?: (ret: ReturnGateInput) => boolean;
}

const refundable = (ret: ReturnGateInput) => totalRefundableUnits(ret.lines ?? []);

/** Mỗi hành động: trạng thái nguồn + quyền cần (+ điều kiện thêm). */
const RULES: Readonly<Record<ReturnAction, ReturnRule>> = {
  approve: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve },
  reject: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve },
  // Rút trước khi hàng về (BE `POST /returns/{id}/cancellation`). WF-05 TH-3: đã có kiện về thì không rút được nữa
  // (`RETURN_GOODS_PARTLY_RECEIVED`) — Sale chốt bằng "Đã nhận đủ hàng"
  cancel: {
    from: ["REQUESTED", "AWAITING_RETURN"],
    needs: RMA_PERMISSIONS.update,
    when: (ret) => !hasGoodsBack(ret.receipt),
  },
  // 17 BR-18: hàng của yêu cầu đã duyệt luôn về qua phiếu nhập hàng hoàn
  createReceipt: { from: ["AWAITING_RETURN"], needs: GOODS_RECEIPT_PERMISSIONS.create },
  // WF-05 TH-3 (BE `POST /returns/{id}/goods-complete`): về thiếu, khách không gửi thêm — chỉ khi đã có ≥ 1 kiện về
  goodsComplete: {
    from: ["AWAITING_RETURN"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => hasGoodsBack(ret.receipt),
  },
  // Đề xuất hoàn ít nhất một đơn vị (BE `RETURN_QUANTITIES_INVALID` khi mọi dòng hoàn được = 0)
  propose: {
    from: ["RECEIVED"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => refundable(ret) > 0,
  },
  // WF-05 TH-4 (BE `POST /returns/{id}/closure-without-refund`): không đơn vị nào đã duyệt về dùng được
  closeWithoutRefund: {
    from: ["RECEIVED"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => refundable(ret) === 0,
  },
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
  "goodsComplete",
  "propose",
  "closeWithoutRefund",
  "approveSettlement",
  "rejectSettlement",
  "cancel",
];

export function allowedReturnActions(ret: ReturnGateInput, can: Can): ReturnAction[] {
  return ORDER.filter((action) => {
    const rule = RULES[action];
    return rule.from.includes(ret.status) && can(rule.needs) && (rule.when?.(ret) ?? true);
  });
}

/**
 * Sale thêm ảnh của khiếu nại khi yêu cầu còn chờ duyệt hoặc chờ hàng về (BE `requireEvidenceAllowed`, stage CLAIM;
 * quyền `sales-rmas:CREATE`). Tách khỏi `allowedReturnActions` vì không phải nút đổi trạng thái.
 */
export function canAddReturnEvidence(ret: Pick<ReturnRequest, "status">, can: Can): boolean {
  return (
    (ret.status === "REQUESTED" || ret.status === "AWAITING_RETURN") && can(RMA_PERMISSIONS.create)
  );
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

/** `loose` = ghi / gỡ hàng lẻ không nhãn (WF-05 TH-4). */
export type ReturnReceiptAction = "scan" | "remove" | "loose" | "confirm" | "cancel";

export function allowedReturnReceiptActions(
  receipt: {
    status: ReturnReceiptApiStatus;
    cartons: readonly unknown[];
    looseLines?: readonly unknown[] | null;
    returnRequestId?: string | null;
  },
  can: Can,
): ReturnReceiptAction[] {
  if (receipt.status !== "DRAFT" || !can(GOODS_RECEIPT_PERMISSIONS.update)) return [];
  const hasCartons = receipt.cartons.length > 0;
  const hasLoose = (receipt.looseLines?.length ?? 0) > 0;
  const actions: ReturnReceiptAction[] = ["scan"];
  if (hasCartons) actions.push("remove");
  // Hàng lẻ chỉ trên phiếu của một yêu cầu trả hàng — chuyến hãng hoàn về thì hàng về trong thùng
  // (BE `ReturnReceipt.recordLoose` → INVALID_RECEIPT_TRANSITION)
  if (receipt.returnRequestId) actions.push("loose");
  // INVALID_RECEIPT_TRANSITION khi phiếu không có thùng lẫn hàng lẻ (BE `ReturnReceipt.confirm`)
  if (hasCartons || hasLoose) actions.push("confirm");
  actions.push("cancel");
  return actions;
}
