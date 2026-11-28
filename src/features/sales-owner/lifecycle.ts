/**
 * Vòng đời và gating thao tác (feature-architecture §6) — khách tiềm năng (§10.7), yêu cầu đổi Sale (§10.5), lịch người
 * thay (BR-S07). UI-only: Backend phải re-check từng thao tác (quyền + kiểm tra trong service).
 */

import type { LeadStatus, OwnerChangeRequestStatus } from "@/constants/sales-owner";
import type { CoverState } from "./selectors";
import type { Lead, OwnerChangeRequest, StaffCover } from "./types";

/** §10.7: `NEW → ASSIGNED → CONTACTED → CONVERTED / DISQUALIFIED` (lý do bắt buộc khi loại). */
export const LEAD_TRANSITIONS: Record<LeadStatus, readonly LeadStatus[]> = {
  NEW: ["ASSIGNED", "DISQUALIFIED"],
  // Quản lý giao lại cho Sale khác được (vẫn ASSIGNED)
  ASSIGNED: ["ASSIGNED", "CONTACTED", "CONVERTED", "DISQUALIFIED"],
  CONTACTED: ["ASSIGNED", "CONVERTED", "DISQUALIFIED"],
  CONVERTED: [],
  DISQUALIFIED: [],
};

const leadNext = (status: string): readonly LeadStatus[] =>
  LEAD_TRANSITIONS[status as LeadStatus] ?? [];

export type LeadAction = "assign" | "contact" | "convert" | "disqualify";

/**
 * Thao tác được phép trên một lead:
 * - quản lý (`sales-leads:UPDATE` + `customer-sales-owners:UPDATE`, hợp đồng "Manager trên FE"): giao / giao lại, loại;
 * - Sale được giao (kể cả quản lý tự nhận, BR-S16): đánh dấu đã liên hệ, chuyển thành khách (cần quyền tạo khách), loại.
 */
export function leadActions(
  lead: Lead,
  ctx: {
    userId: string | null;
    canUpdate: boolean;
    isManager: boolean;
    canCreateCustomer: boolean;
  },
): LeadAction[] {
  if (!ctx.canUpdate) return [];
  const next = leadNext(lead.status);
  const assignee = !!ctx.userId && lead.assignedTo === ctx.userId;
  const actions: LeadAction[] = [];
  if (ctx.isManager && next.includes("ASSIGNED")) actions.push("assign");
  if (assignee && next.includes("CONTACTED")) actions.push("contact");
  if (assignee && ctx.canCreateCustomer && next.includes("CONVERTED")) actions.push("convert");
  if ((ctx.isManager || assignee) && next.includes("DISQUALIFIED")) actions.push("disqualify");
  return actions;
}

/** §10.5: chỉ yêu cầu đang chờ mới quyết được; đã đồng ý / từ chối / khách rút là kết thúc. */
export const OWNER_CHANGE_REQUEST_TRANSITIONS: Record<
  OwnerChangeRequestStatus,
  readonly OwnerChangeRequestStatus[]
> = {
  PENDING: ["APPROVED", "REJECTED", "WITHDRAWN"],
  APPROVED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function canDecideRequest(request: OwnerChangeRequest, canApprove: boolean): boolean {
  const next = OWNER_CHANGE_REQUEST_TRANSITIONS[request.status as OwnerChangeRequestStatus] ?? [];
  return canApprove && next.includes("APPROVED");
}

/** BR-S07: huỷ lịch chưa hết — Sale chỉ lịch của mình, quản lý mọi lịch (BE kiểm lại). */
export function canCancelCover(
  cover: StaffCover,
  state: CoverState,
  ctx: { userId: string | null; canUpdate: boolean; isManager: boolean },
): boolean {
  if (!ctx.canUpdate || state === "ENDED" || state === "CANCELLED") return false;
  return ctx.isManager || cover.userId === ctx.userId;
}
