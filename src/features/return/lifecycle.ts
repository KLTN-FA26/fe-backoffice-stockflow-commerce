/**
 * Vòng đời yêu cầu trả hàng và phiếu nhập hàng hoàn — chép BE `ReturnStatus.canTransitionTo` (docs 17 §4.10 không
 * có bảng trạng thái riêng cho RMA; code BE là nguồn đúng) và `GoodsReceiptStatus` của phiếu loại RETURN (03 §4.2).
 * UI-only — Backend phải re-check (quyền `sales-rmas`, `sales-rma-resolutions`, `procurement-goods-receipts`;
 * bốn mắt `RETURN_SELF_APPROVAL`).
 */

import { GOODS_RECEIPT_PERMISSIONS } from "@/constants/permissions";
import {
  RETURN_API_STATUSES,
  RETURN_OPEN_STATUSES,
  RETURN_RECEIPT_APPROVAL_PERMISSIONS,
  RETURN_RECEIPT_FALLBACK_STATUSES,
  RMA_CUSTODY_PERMISSIONS,
  RMA_PERMISSIONS,
  RMA_RESOLUTION_PERMISSIONS,
} from "@/constants/returns";

import { claimEvidence, hasGoodsBack, totalRefundableUnits } from "./selectors";

import type {
  ReturnApiStatus,
  ReturnReadStatus,
  ReturnReceiptReadStatus,
} from "@/constants/returns";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { CustodyOutcome, ReturnReceipt, ReturnRequest } from "./types";

/** Thùng đang giữ hộ khách (BE `ReturnedCartonOwnership.CUSTOMER_HELD`). */
const CUSTOMER_HELD_OWNERSHIP = "CUSTOMER_HELD";

/**
 * BE `ReturnStatus.canTransitionTo`. Phiếu nhập mở trước khi hết hạn / bị rút vẫn đưa hàng về (EXPIRED / CANCELLED →
 * RECEIVED) — đó là việc của kho, không phải nút trên màn RMA. RESOLVED / REJECTED / INSPECTED là cuối.
 */
export const RETURN_TRANSITIONS: Readonly<Record<ReturnReadStatus, readonly ReturnApiStatus[]>> = {
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
  // Trạng thái BE thêm sau: FE không đoán — không thao tác (WF-05 BO-11)
  UNKNOWN: [],
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
 * Phần của yêu cầu mà nút cần: trạng thái, hàng đã về (`receipt`), các dòng (số hoàn được) và hai cờ BE tính sẵn
 * (`receiptOpenable`, `receiptDraftOpen` — WF-05 Q-11, BE-23). `receipt` / `lines` vắng mặt = chưa có hàng về, không đơn
 * vị nào hoàn được; cờ vắng mặt = BE cũ (dùng quy tắc dự phòng).
 */
export type ReturnGateInput = Pick<ReturnRequest, "status"> &
  Partial<
    Pick<
      ReturnRequest,
      | "receipt"
      | "lines"
      | "receiptOpenable"
      | "receiptDraftOpen"
      | "evidence"
      | "channel"
      | "requestedBy"
      | "resolution"
    >
  >;

interface ReturnRule {
  from: readonly ReturnApiStatus[];
  needs: PermissionCode;
  /**
   * Điều kiện thêm trên dữ liệu của yêu cầu (ngoài trạng thái + quyền). `userId` = người đang xem (null = chưa biết — không
   * chặn theo bốn mắt; BE vẫn kiểm).
   */
  when?: (ret: ReturnGateInput, userId: string | null) => boolean;
}

const refundable = (ret: ReturnGateInput) => totalRefundableUnits(ret.lines ?? []);

/**
 * WF-05 BE-23: kho đang đếm một kiện của yêu cầu trên phiếu NHÁP — BE từ chối chốt "Đã nhận đủ", đề xuất, duyệt hoàn tiền
 * và kết thúc không hoàn (`RETURN_RECEIPT_DRAFT_OPEN`), và lập phiếu thứ hai (`RETURN_RECEIPT_ALREADY_OPEN`). Cờ vắng = BE
 * cũ: không chặn (BE vẫn kiểm lại).
 */
const noDraftCounting = (ret: ReturnGateInput) => ret.receiptDraftOpen !== true;

/**
 * Kho lập được phiếu nhập hàng hoàn (WF-05 Q-11, BE-13): BE gửi `receiptOpenable` (hàng về muộn sau "Đã nhận đủ", hết hạn,
 * rút sau duyệt, đã có phiếu trước — nhiều phiếu một yêu cầu) thì theo đúng cờ đó; BE cũ thì chỉ khi chờ hàng về.
 */
export function receiptOpenable(ret: ReturnGateInput): boolean {
  if (ret.receiptOpenable != null) return ret.receiptOpenable;
  return (RETURN_RECEIPT_FALLBACK_STATUSES as readonly string[]).includes(ret.status);
}

/**
 * Chọn được làm nguồn lập phiếu nhập hàng hoàn ngay bây giờ: BE cho mở (`receiptOpenable`) và không có phiếu NHÁP nào
 * đang đếm (`receiptDraftOpen`, BE-23 — có thì BE trả 409 RETURN_RECEIPT_ALREADY_OPEN; màn đưa tới phiếu nháp đó).
 */
export function receiptCreatableNow(ret: ReturnGateInput): boolean {
  return receiptOpenable(ret) && noDraftCounting(ret);
}

/** Mỗi hành động: trạng thái nguồn + quyền cần (+ điều kiện thêm). */
/**
 * Audit r2 L15 — BE `ReturnRequest.approve`: cần ít nhất một ảnh khiếu nại (`RETURN_EVIDENCE_REQUIRED`; `evidence` vắng = BE
 * cũ, không chặn), và yêu cầu Sale mở thay khách không do chính người đó duyệt (`RETURN_SELF_APPROVAL`, bốn mắt).
 */
const approvable = (ret: ReturnGateInput, userId: string | null) =>
  (ret.evidence == null || claimEvidence({ evidence: ret.evidence }).length > 0) &&
  !(userId !== null && ret.channel === "BACK_OFFICE" && ret.requestedBy === userId);

/** Audit r2 L15 — BE `requireSettlementApprover`: người đề xuất hoàn tiền không tự duyệt (`RETURN_SELF_APPROVAL`). */
const notProposer = (ret: ReturnGateInput, userId: string | null) =>
  !(userId !== null && ret.resolution?.proposedBy === userId);

const RULES: Readonly<Record<ReturnAction, ReturnRule>> = {
  approve: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve, when: approvable },
  reject: { from: ["REQUESTED"], needs: RMA_PERMISSIONS.approve },
  // Rút trước khi hàng về (BE `POST /returns/{id}/cancellation`). WF-05 TH-3: đã có kiện về thì không rút được nữa
  // (`RETURN_GOODS_PARTLY_RECEIVED`) — Sale chốt bằng "Đã nhận đủ hàng". Audit r2 M-3 (BE-23): kho đang đếm một kiện trên
  // phiếu NHÁP thì cũng chưa rút được (`RETURN_RECEIPT_DRAFT_OPEN`) — rút lúc đó, đơn về DELIVERED trước khi phiếu mở lại yêu
  // cầu
  cancel: {
    from: ["REQUESTED", "AWAITING_RETURN"],
    needs: RMA_PERMISSIONS.update,
    when: (ret) => !hasGoodsBack(ret.receipt) && noDraftCounting(ret),
  },
  // 17 BR-18: hàng của yêu cầu đã duyệt luôn về qua phiếu nhập hàng hoàn. WF-05 Q-11: BE quyết trạng thái nào mở được
  // (`receiptOpenable`); trạng thái lạ (UNKNOWN) không bao giờ mở
  createReceipt: {
    from: RETURN_API_STATUSES,
    needs: GOODS_RECEIPT_PERMISSIONS.create,
    when: receiptCreatableNow,
  },
  // WF-05 TH-3 (BE `POST /returns/{id}/goods-complete`): về thiếu, khách không gửi thêm — chỉ khi đã có ≥ 1 kiện về.
  // BE-23: còn phiếu nháp đang đếm thì chưa chốt được (`RETURN_RECEIPT_DRAFT_OPEN`)
  goodsComplete: {
    from: ["AWAITING_RETURN"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => hasGoodsBack(ret.receipt) && noDraftCounting(ret),
  },
  // Còn đơn vị hoàn được thì Sale đề xuất — kể cả 0 đồng có lý do không hoàn (WF-05 Q-4, BE-12: mọi dòng 0 + lý do cố
  // định, Kế toán duyệt bằng nút "Duyệt hoàn tiền"). Không còn đơn vị nào thì "Kết thúc không hoàn tiền"
  propose: {
    from: ["RECEIVED"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => refundable(ret) > 0 && noDraftCounting(ret),
  },
  // WF-05 TH-4 (BE `POST /returns/{id}/closure-without-refund`): không đơn vị nào đã duyệt về dùng được
  closeWithoutRefund: {
    from: ["RECEIVED"],
    needs: RMA_RESOLUTION_PERMISSIONS.propose,
    when: (ret) => refundable(ret) === 0 && noDraftCounting(ret),
  },
  approveSettlement: {
    from: ["SETTLEMENT_PENDING"],
    needs: RMA_RESOLUTION_PERMISSIONS.approve,
    when: (ret, userId) => noDraftCounting(ret) && notProposer(ret, userId),
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

export function allowedReturnActions(
  ret: ReturnGateInput,
  can: Can,
  userId: string | null = null,
): ReturnAction[] {
  return ORDER.filter((action) => {
    const rule = RULES[action];
    return (
      (rule.from as readonly string[]).includes(ret.status) &&
      can(rule.needs) &&
      (rule.when?.(ret, userId) ?? true)
    );
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

/**
 * Biên nhận giữ hộ (WF-05 Q-11; BE G4 `ReturnRequest.requireEvidenceAllowed` CUSTODY): ghi được ở MỌI trạng thái — hàng
 * không được nhận có thể về bất cứ lúc nào (kèm khiếu nại, vượt số duyệt, sau khi đã chốt tiền hay bị từ chối). Quyền riêng
 * `sales-rma-custody:CREATE` (audit r2 returns M4: kho ở cửa nhận hàng và Sale; trước đây `sales-rmas:CREATE` — mọi vai kho
 * bị 403). UI-only — BE kiểm lại.
 */
export function canAddCustody(_ret: Pick<ReturnRequest, "status">, can: Can): boolean {
  return can(RMA_CUSTODY_PERMISSIONS.create);
}

/**
 * Sale ghi lựa chọn của khách cho thùng giữ hộ (WF-05 Q-4; BE `ReturnRequest.recordCustodyChoice`): yêu cầu RESOLVED có ít
 * nhất một thùng đang giữ hộ chưa xử lý (`custodyCartons`, BE r3c). Audit r3 RAD-1: thùng tính theo từng SKU — một yêu cầu
 * CÓ hoàn tiền vẫn có thể giữ hộ thùng của SKU không hoàn, hay thùng nguyên vượt số đơn vị được hoàn; điều kiện cũ "không
 * đơn vị nào được hoàn" đã bỏ. `custodyCartons` vắng (BE cũ) → không mở. Quyền `sales-rmas:UPDATE`. UI-only — BE kiểm lại.
 */
export function canRecordCustodyChoice(
  ret: Pick<ReturnRequest, "status" | "custodyCartons">,
  can: Can,
): boolean {
  return (
    ret.status === "RESOLVED" &&
    (ret.custodyCartons ?? []).some(
      (carton) => carton.ownership === CUSTOMER_HELD_OWNERSHIP && !carton.endedAt,
    ) &&
    can(RMA_PERMISSIONS.update)
  );
}

/**
 * Audit r3 RAD-3 (Q-11 hỏi thêm; BE `ReturnRequest.chooseForCustody`): Sale ghi / đổi lựa chọn của khách cho hàng trên một
 * biên nhận giữ hộ — ở mọi trạng thái của yêu cầu, khi hàng chưa rời kho. `sales-rmas:UPDATE` (chỉ back office). UI-only.
 */
export function canChooseForCustodyNote(
  outcome: Pick<CustodyOutcome, "endedAt"> | null | undefined,
  can: Can,
): boolean {
  return !outcome?.endedAt && can(RMA_PERMISSIONS.update);
}

/**
 * Audit r3 RAD-3 (TH-6; BE `ReturnRequest.endCustody`): Quản lý kho ghi hàng trên biên nhận đã rời kho — chỉ khi Sale đã ghi
 * lựa chọn (không có → BE 409 RETURN_CUSTODY_CHOICE_REQUIRED) và chưa ghi rời kho. `sales-rma-custody:UPDATE`. UI-only.
 */
export function canEndCustodyNote(
  outcome: Pick<CustodyOutcome, "endedAt"> | null | undefined,
  can: Can,
): boolean {
  return !!outcome && !outcome.endedAt && can(RMA_CUSTODY_PERMISSIONS.update);
}

/** BE `ReturnStatus.isOpen`. Trạng thái lạ (UNKNOWN) không coi là đang mở — BE vẫn kiểm lại mọi thao tác. */
export function isReturnOpen(status: ReturnReadStatus): boolean {
  return (RETURN_OPEN_STATUSES as readonly string[]).includes(status);
}

/** Phiếu hàng hoàn: DRAFT → CLOSED (xác nhận) / CANCELLED; không qua duyệt, không putaway (BE `ReturnReceipt`). */
export const RETURN_RECEIPT_TRANSITIONS: Readonly<
  Record<ReturnReceiptReadStatus, readonly ReturnReceiptReadStatus[]>
> = {
  DRAFT: ["CLOSED", "CANCELLED"],
  PENDING_APPROVAL: [],
  CONFIRMED: [],
  IN_PUTAWAY: [],
  CLOSED: [],
  CANCELLED: [],
  UNKNOWN: [],
};

/** `loose` = ghi / gỡ hàng lẻ không nhãn (WF-05 TH-4). */
export type ReturnReceiptAction = "scan" | "remove" | "loose" | "confirm" | "cancel";

/**
 * Phiếu nhập kho 01-VT của phiếu hàng hoàn (BE `feat/business-documents` #3): chỉ khi phiếu đã xác nhận (BE 409
 * `INVALID_RECEIPT_TRANSITION` trước đó). Quyền đọc (`procurement-goods-receipts:READ`) do nút kiểm — owner 2026-11-23:
 * Kế toán xem và in được, nhưng không có thao tác sửa nào (các thao tác trên cần UPDATE).
 */
export function returnReceiptVoucherReady(receipt: { status: ReturnReceiptReadStatus }): boolean {
  return (
    receipt.status === "CONFIRMED" || receipt.status === "IN_PUTAWAY" || receipt.status === "CLOSED"
  );
}

export function allowedReturnReceiptActions(
  receipt: {
    status: ReturnReceiptReadStatus;
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
  // INVALID_RECEIPT_TRANSITION khi phiếu không có thùng lẫn hàng lẻ (BE `ReturnReceipt.confirm`). Phiếu cần Quản lý kho
  // (WF-05 Q-18) vẫn hiện nút — màn khoá nút và nói lý do theo `returnReceiptConfirmBlock`
  if (hasCartons || hasLoose) actions.push("confirm");
  actions.push("cancel");
  return actions;
}

/** Thùng về đã mở / rỗng (WF-05 TH-4, Q-18): BE đánh `opened`, hoặc số đếm thật ít hơn nhãn. */
export const cartonOpened = (carton: {
  opened?: boolean | null;
  countedQuantity?: number | null;
  quantity: number;
}): boolean =>
  carton.opened === true ||
  (carton.countedQuantity != null && carton.countedQuantity < carton.quantity);

/**
 * Phiếu có thùng mở hoặc hàng lẻ → chỉ Quản lý kho xác nhận, và khác người đếm (WF-05 Q-18). BE tính sẵn
 * `managerConfirmationRequired` — FE theo cờ đó; cờ vắng (BE cũ) thì suy từ thùng / hàng lẻ như BE
 * `ReturnReceipt.needsManagerConfirmation`.
 */
export function needsManagerConfirmation(
  receipt: Pick<ReturnReceipt, "cartons" | "looseLines" | "managerConfirmationRequired">,
): boolean {
  if (receipt.managerConfirmationRequired != null) return receipt.managerConfirmationRequired;
  return receipt.cartons.some(cartonOpened) || (receipt.looseLines?.length ?? 0) > 0;
}

export type ReturnReceiptConfirmBlock = "managerRequired" | "selfConfirmation";

/**
 * Vì sao nút "Xác nhận nhập" khoá (WF-05 Q-18; BE `RETURN_RECEIPT_MANAGER_CONFIRMATION_REQUIRED` /
 * `RETURN_RECEIPT_SELF_CONFIRMATION`): phiếu có thùng mở / hàng lẻ mà người bấm không có quyền duyệt phiếu nhập hàng hoàn,
 * hoặc chính người bấm đã quét thùng / ghi hàng lẻ trên phiếu. Đây là kiểm quyền, không phải trạng thái mới. `null` = bấm
 * được. UI-only — BE kiểm lại.
 */
export function returnReceiptConfirmBlock(
  receipt: Pick<ReturnReceipt, "cartons" | "looseLines" | "managerConfirmationRequired">,
  can: Can,
  userId: string | null,
): ReturnReceiptConfirmBlock | null {
  if (!needsManagerConfirmation(receipt)) return null;
  if (!can(RETURN_RECEIPT_APPROVAL_PERMISSIONS.approve)) return "managerRequired";
  if (!userId) return null;
  // BE `ReturnReceipt.countedBy`: quét thùng, đếm lại thùng, hoặc ghi hàng lẻ
  const counted =
    receipt.cartons.some((carton) => carton.scannedBy === userId || carton.countedBy === userId) ||
    (receipt.looseLines ?? []).some((line) => line.recordedBy === userId);
  return counted ? "selfConfirmation" : null;
}
