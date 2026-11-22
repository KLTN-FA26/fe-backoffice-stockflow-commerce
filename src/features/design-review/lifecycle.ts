/**
 * Vòng đời thiết kế của khách — BE `DesignStatus` / `DesignReviewService` (origin/develop 5fe7b9a16), kltn-docs 12 BR-06,
 * BR-09, BR-11:
 *   DRAFT → PENDING_REVIEW (khách gửi duyệt)
 *   PENDING_REVIEW → APPROVED (Điều phối sản xuất duyệt: đóng dấu file in, sinh SKU riêng, khoá thiết kế)
 *                  | DRAFT (Điều phối trả lại, lý do bắt buộc) | DRAFT (khách rút lại)
 *   APPROVED → ARCHIVED ; ARCHIVED: trạng thái cuối.
 * UI-only — Backend phải re-check (`@RequiresPermission design-designs:APPROVE`, `requirePending`).
 */

import { DESIGN_REVIEW_LABELS } from "@/constants";

import { isDecidable } from "./selectors";

import type { DesignStatus } from "@/constants";
import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { Design } from "./types";

export const DESIGN_TRANSITIONS: Readonly<Record<DesignStatus, readonly DesignStatus[]>> = {
  DRAFT: ["PENDING_REVIEW"],
  PENDING_REVIEW: ["APPROVED", "DRAFT"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export type ReviewActionCode = "approve" | "return";

export interface ReviewAction {
  code: ReviewActionCode;
  label: string;
}

/** Duyệt / Trả lại chỉ khi thiết kế đang chờ duyệt và có quyền APPROVE; còn lại chỉ xem. */
export function allowedReviewActions(
  design: Pick<Design, "status">,
  can: (code: PermissionCode) => boolean,
): readonly ReviewAction[] {
  if (!isDecidable(design, can)) return [];
  return [
    { code: "approve", label: DESIGN_REVIEW_LABELS.approve },
    { code: "return", label: DESIGN_REVIEW_LABELS.return },
  ];
}
