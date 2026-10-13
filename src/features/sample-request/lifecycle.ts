/**
 * Vòng đời yêu cầu mẫu — chép BE `SampleStatus.canTransitionTo` + bước hệ thống (d215f6e,
 * handoff SCRUM-394-395):
 *   DRAFT → SUBMITTED (gửi sản xuất, giữ phôi — Q1) | CANCELLED ; sửa quy cách chỉ khi DRAFT
 *   SUBMITTED → IN_PRODUCTION → READY (do LSX mẫu chạy, không có nút)
 *   READY → SENT_TO_CUSTOMER (gửi mẫu cho khách)
 *   SENT_TO_CUSTOMER → APPROVED | CHANGES_REQUESTED (khách, hoặc Sales ghi nhận thay khách)
 *   CHANGES_REQUESTED → (vòng mới DRAFT) ; CANCELLED vì LSX bị huỷ/dừng → vòng mới (Q5: không kế
 *   thừa duyệt, giữ phôi lại từ đầu)
 *   APPROVED, CANCELLED, CHANGES_REQUESTED: cuối với chính vòng đó.
 * UI-only — Backend phải re-check (quyền production-sample-requests + phạm vi kho / khách).
 */

import { SAMPLE_REQUEST_PERMISSIONS } from "@/constants";

import type { SampleApiStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";

export type SampleAction =
  "edit" | "submit" | "cancel" | "send" | "approve" | "requestChanges" | "nextRound";

export const SAMPLE_TRANSITIONS: Readonly<Record<SampleApiStatus, readonly SampleApiStatus[]>> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["IN_PRODUCTION", "READY", "CANCELLED"],
  IN_PRODUCTION: ["READY", "CANCELLED"],
  READY: ["SENT_TO_CUSTOMER"],
  SENT_TO_CUSTOMER: ["APPROVED", "CHANGES_REQUESTED"],
  CHANGES_REQUESTED: [],
  APPROVED: [],
  CANCELLED: [],
};

const NEEDS: Readonly<Record<SampleAction, PermissionCode>> = {
  edit: SAMPLE_REQUEST_PERMISSIONS.update,
  submit: SAMPLE_REQUEST_PERMISSIONS.update,
  cancel: SAMPLE_REQUEST_PERMISSIONS.update,
  send: SAMPLE_REQUEST_PERMISSIONS.update,
  approve: SAMPLE_REQUEST_PERMISSIONS.approve,
  requestChanges: SAMPLE_REQUEST_PERMISSIONS.approve,
  nextRound: SAMPLE_REQUEST_PERMISSIONS.create,
};

export interface SampleState {
  status: SampleApiStatus;
  /** Vòng kế tiếp đã tồn tại → không tạo thêm (BE SAMPLE_NEXT_ROUND_EXISTS). */
  hasNextRound: boolean;
  /** LSX mẫu đã huỷ / dừng — điều kiện mở vòng mới từ CANCELLED. */
  productionCancelled: boolean;
}

function candidates(state: SampleState): SampleAction[] {
  switch (state.status) {
    case "DRAFT":
      return ["edit", "submit", "cancel"];
    case "READY":
      return ["send"];
    case "SENT_TO_CUSTOMER":
      return ["approve", "requestChanges"];
    case "CHANGES_REQUESTED":
      return state.hasNextRound ? [] : ["nextRound"];
    case "CANCELLED":
      return state.productionCancelled && !state.hasNextRound ? ["nextRound"] : [];
    default:
      return [];
  }
}

/** Nút back-office (Sales). Khách portal chỉ dùng approve / requestChanges. */
export function allowedSampleActions(
  state: SampleState,
  can: (code: PermissionCode) => boolean,
): SampleAction[] {
  return candidates(state).filter((action) => can(NEEDS[action]));
}

export function allowedPortalSampleActions(
  status: SampleApiStatus,
  can: (code: PermissionCode) => boolean,
): SampleAction[] {
  return status === "SENT_TO_CUSTOMER" && can(SAMPLE_REQUEST_PERMISSIONS.approve)
    ? ["approve", "requestChanges"]
    : [];
}
