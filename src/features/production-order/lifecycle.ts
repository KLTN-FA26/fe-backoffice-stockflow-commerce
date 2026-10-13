/**
 * Thao tác LSX theo trạng thái — chép bảng chuyển tiếp của BE `ProductionOrder` (d215f6e,
 * handoff SCRUM-394-395 / SPRINT2-WORKSHOP-PLAN). "eff" = trạng thái trước khi treo khi ON_HOLD.
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
import type { ProductionDetail } from "./types";

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
