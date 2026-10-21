/**
 * Thao tác LSX theo trạng thái — chép bảng chuyển tiếp của BE `ProductionOrder` (d215f6e,
 * BE docs/handoffs/SCRUM-394-395.md / BE docs/handoffs/SPRINT2-WORKSHOP-PLAN.md). "eff" = trạng thái trước khi treo khi ON_HOLD.
 *   PENDING_PREPRESS: prepress PASS→READY / FAIL→ON_HOLD(FILE_REJECTED) (BR-PRD-02); treo; huỷ; tách gia công
 *   READY: xuất phôi (tại xưởng) → MATERIAL_ISSUED khi đủ (BR-PRD-03); gửi gia công (LSX gia công); treo; huỷ
 *   MATERIAL_ISSUED: bắt đầu in → PRINTING; treo; huỷ
 *   PRINTING: ghi sản lượng → QC (BR-PRD-04 phế trừ kho); treo; dừng
 *   SUBCONTRACTED: nhận hàng (hệ thống) → QC; treo; huỷ (quy trình gia công)
 *   QC: ghi QC → COMPLETED / READY (thiếu → in bù); treo; dừng
 *   ON_HOLD: tiếp tục → trạng thái trước; huỷ nếu eff ∈ {PENDING_PREPRESS, READY, MATERIAL_ISSUED}; dừng nếu eff ∈ {PRINTING, QC}
 *   COMPLETED, CANCELLED: cuối — không nút nào.
 * UI-only — Backend phải re-check (quyền + phạm vi kho + khoá dòng).
 */

import {
  MATERIAL_ISSUE_PERMISSIONS,
  PRODUCTION_ORDER_PERMISSIONS,
  PRODUCTION_QC_PERMISSIONS,
} from "@/constants";

import { effectiveStatus } from "./selectors";

import type { ProductionApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductionDetail, Settlement, SubcontractReceipt } from "./types";

export type ProductionAction =
  | "prepress"
  | "issue"
  | "startPrinting"
  | "output"
  | "qc"
  | "hold"
  | "resume"
  | "cancel"
  | "stop"
  | "split"
  | "dispatch";

const HOLDABLE: readonly ProductionApiStatus[] = [
  "PENDING_PREPRESS",
  "READY",
  "MATERIAL_ISSUED",
  "PRINTING",
  "SUBCONTRACTED",
  "QC",
];
const CANCELLABLE_IN_HOUSE: readonly ProductionApiStatus[] = [
  "PENDING_PREPRESS",
  "READY",
  "MATERIAL_ISSUED",
];
const CANCELLABLE_SUBCONTRACT: readonly ProductionApiStatus[] = [
  "PENDING_PREPRESS",
  "READY",
  "SUBCONTRACTED",
];
const STOPPABLE: readonly ProductionApiStatus[] = ["PRINTING", "QC"];
const SPLITTABLE: readonly ProductionApiStatus[] = ["PENDING_PREPRESS", "READY", "ON_HOLD"];

export const TERMINAL_PRODUCTION_STATUSES: readonly ProductionApiStatus[] = [
  "COMPLETED",
  "CANCELLED",
];

export function allowedProductionActions(
  order: ProductionDetail,
  can: (code: PermissionCode) => boolean,
): ProductionAction[] {
  const { status, mode, type, parentId } = order.summary;
  if (TERMINAL_PRODUCTION_STATUSES.includes(status)) return [];
  const eff = effectiveStatus(order);
  const inHouse = mode === "IN_HOUSE";
  const update = can(PRODUCTION_ORDER_PERMISSIONS.update);
  const approve = can(PRODUCTION_ORDER_PERMISSIONS.approve);
  const actions: ProductionAction[] = [];
  if (status === "PENDING_PREPRESS" && update) actions.push("prepress");
  if (status === "READY" && inHouse && can(MATERIAL_ISSUE_PERMISSIONS.create))
    actions.push("issue");
  if (status === "READY" && !inHouse && can(MATERIAL_ISSUE_PERMISSIONS.create))
    actions.push("dispatch");
  if (status === "MATERIAL_ISSUED" && update) actions.push("startPrinting");
  if (status === "PRINTING" && update) actions.push("output");
  if (status === "QC" && can(PRODUCTION_QC_PERMISSIONS.create)) actions.push("qc");
  if (HOLDABLE.includes(status) && update) actions.push("hold");
  if (status === "ON_HOLD" && approve) actions.push("resume");
  const cancellable = inHouse ? CANCELLABLE_IN_HOUSE : CANCELLABLE_SUBCONTRACT;
  if (approve && eff && cancellable.includes(eff)) actions.push("cancel");
  if (approve && eff && STOPPABLE.includes(eff)) actions.push("stop");
  // BR-PRD-11/12: chỉ LSX đơn, tại xưởng, chưa có cha mới tách gia công được.
  if (approve && type === "ORDER" && inHouse && !parentId && SPLITTABLE.includes(status))
    actions.push("split");
  return actions;
}

export type SubcontractRecoveryAction = "recall" | "inHouse" | "supplement";

const IN_HOUSE_FROM: readonly ProductionApiStatus[] = [
  "PENDING_PREPRESS",
  "READY",
  "SUBCONTRACTED",
  "QC",
];

/**
 * Xử lý sự cố gia công (QA2): thu hồi phôi (chỉ gửi phôi, quyền xuất phôi), chuyển phần còn lại
 * về xưởng khi eff ∈ {PENDING_PREPRESS, READY, SUBCONTRACTED, QC}, đặt thêm khi chưa kết thúc —
 * hai thao tác sau cần `production-orders:APPROVE`. UI-only — BE kiểm tra số lượng / phôi còn ở NCC.
 */
export function allowedSubcontractRecovery(
  order: ProductionDetail,
  can: (code: PermissionCode) => boolean,
): SubcontractRecoveryAction[] {
  const { status, mode } = order.summary;
  if (mode !== "SUBCONTRACTED" || TERMINAL_PRODUCTION_STATUSES.includes(status)) return [];
  const eff = effectiveStatus(order);
  const actions: SubcontractRecoveryAction[] = [];
  if (order.subcontract?.method === "SUPPLIED_BLANKS" && can(MATERIAL_ISSUE_PERMISSIONS.create))
    actions.push("recall");
  if (can(PRODUCTION_ORDER_PERMISSIONS.approve) && eff && IN_HOUSE_FROM.includes(eff))
    actions.push("inHouse");
  if (can(PRODUCTION_ORDER_PERMISSIONS.approve)) actions.push("supplement");
  return actions;
}

/**
 * Bảng chuyển trạng thái (tài liệu + test) — chép từ BE `ProductionOrder` (BE develop 492a2d61,
 * BE docs/handoffs/SCRUM-394-395.md). Ngoài các nút ở header file này còn có bước của hệ thống:
 *   READY → QC: LSX gia công nhận nốt hàng sau một lần QC thiếu (`receivedFromSubcontractor`).
 *   READY / SUBCONTRACTED / QC / ON_HOLD → COMPLETED: lấy phần còn nợ về xưởng khi không còn nợ và không
 *   còn hàng chờ QC (`giveBackToPrintShop`, 03 §16 G9); lấy về toàn bộ → CANCELLED.
 *   PRINTING → READY: ghi sản lượng mà mọi cái đều phế (BE ghi PRINTING→QC→READY trong cùng lượt).
 */
export const PRODUCTION_TRANSITIONS: Readonly<
  Record<ProductionApiStatus, readonly ProductionApiStatus[]>
> = {
  PENDING_PREPRESS: ["READY", "ON_HOLD", "CANCELLED"],
  READY: ["MATERIAL_ISSUED", "SUBCONTRACTED", "QC", "ON_HOLD", "COMPLETED", "CANCELLED"],
  MATERIAL_ISSUED: ["PRINTING", "ON_HOLD", "CANCELLED"],
  PRINTING: ["QC", "READY", "ON_HOLD", "CANCELLED"],
  SUBCONTRACTED: ["QC", "ON_HOLD", "COMPLETED", "CANCELLED"],
  QC: ["COMPLETED", "READY", "ON_HOLD", "CANCELLED"],
  ON_HOLD: [
    "PENDING_PREPRESS",
    "READY",
    "MATERIAL_ISSUED",
    "PRINTING",
    "SUBCONTRACTED",
    "QC",
    "COMPLETED",
    "CANCELLED",
  ],
  COMPLETED: [],
  CANCELLED: [],
};

/** Đối soát phôi một lần nhận (Q9): chỉ hình thức gửi phôi, chưa đối soát, quyền xuất phôi. */
export function canReconcileReceipt(
  order: ProductionDetail,
  receipt: SubcontractReceipt,
  can: (code: PermissionCode) => boolean,
): boolean {
  return (
    order.subcontract?.method === "SUPPLIED_BLANKS" &&
    !receipt.reconciledAt &&
    can(MATERIAL_ISSUE_PERMISSIONS.create)
  );
}

/** Duyệt khấu trừ hao hụt (QA1): quyết toán chờ duyệt + `production-orders:APPROVE`. */
export function canApproveLoss(
  settlement: Settlement,
  can: (code: PermissionCode) => boolean,
): boolean {
  return settlement.status === "AWAITING_APPROVAL" && can(PRODUCTION_ORDER_PERMISSIONS.approve);
}
