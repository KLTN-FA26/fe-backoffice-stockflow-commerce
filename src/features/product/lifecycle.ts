/**
 * Product — lifecycle & action-gating.
 *
 * Source: docs/warehouse/01-product-creation §5 + §6.
 */

import { can } from "@/lib/auth/permissions";
import {
  SKU_TRANSITIONS,
  allowedTransitions,
  canTransition,
  isTerminal,
} from "@/lib/domain/lifecycle";

import type { Permission } from "@/lib/auth/permissions";
import type { RoleName } from "@/lib/auth/roles";
import type { ProductStatus, SkuStatus } from "./types";

export { SKU_TRANSITIONS, allowedTransitions, canTransition, isTerminal };

export type BackendProductStatus = Exclude<ProductStatus, "Active" | "Inactive">;

/** Exact ProductStatus state machine from backend develop. */
export const PRODUCT_TRANSITIONS: Record<BackendProductStatus, readonly BackendProductStatus[]> = {
  Draft: ["Pending Approval"],
  "Pending Approval": ["Approved", "Draft"],
  Approved: ["Published", "Discontinued"],
  Published: ["Approved", "Discontinued"],
  Discontinued: [],
};

export interface ProductAction {
  readonly code: string;
  readonly label: string;
  readonly permission: Permission;
  readonly fromStatuses: readonly ProductStatus[];
  readonly targetStatus?: ProductStatus;
  readonly transition?: "submit" | "approve" | "reject" | "discontinue" | "publish" | "unpublish";
  readonly destructive?: boolean;
}

export interface SkuAction {
  readonly code: string;
  readonly label: string;
  readonly permission: Permission;
  readonly fromStatuses: readonly SkuStatus[];
  readonly targetStatus?: SkuStatus;
  readonly destructive?: boolean;
}

export const PRODUCT_ACTIONS: readonly ProductAction[] = [
  {
    code: "edit",
    label: "Chỉnh sửa",
    permission: "product.edit",
    fromStatuses: ["Draft"],
  },
  // docs §4.8: Submit for review → Pending Approval.
  {
    code: "submit",
    label: "Gửi duyệt",
    permission: "product.edit",
    fromStatuses: ["Draft"],
    targetStatus: "Pending Approval",
    transition: "submit",
  },
  // docs §4.9: Approve → Approved; reject returns Draft.
  {
    code: "approve",
    label: "Phê duyệt",
    permission: "product.approve",
    fromStatuses: ["Pending Approval"],
    targetStatus: "Approved",
    transition: "approve",
  },
  {
    code: "reject",
    label: "Từ chối",
    permission: "product.approve",
    fromStatuses: ["Pending Approval"],
    targetStatus: "Draft",
    transition: "reject",
    destructive: true,
  },
  {
    code: "publish",
    label: "Xuất bản",
    permission: "product.approve",
    fromStatuses: ["Approved"],
    targetStatus: "Published",
    transition: "publish",
  },
  {
    code: "unpublish",
    label: "Gỡ xuất bản",
    permission: "product.approve",
    fromStatuses: ["Published"],
    targetStatus: "Approved",
    transition: "unpublish",
  },
  {
    code: "discontinue",
    label: "Ngừng kinh doanh",
    permission: "product.approve",
    fromStatuses: ["Approved", "Published"],
    targetStatus: "Discontinued",
    transition: "discontinue",
    destructive: true,
  },
] as const;

export const SKU_ACTIONS: readonly SkuAction[] = [
  {
    code: "block",
    label: "Khoá SKU",
    permission: "product.edit",
    fromStatuses: ["Active"],
    targetStatus: "Blocked",
    destructive: true,
  },
  {
    code: "unblock",
    label: "Mở khoá SKU",
    permission: "product.edit",
    fromStatuses: ["Blocked"],
    targetStatus: "Active",
  },
  {
    code: "obsolete",
    label: "Ngừng dùng SKU",
    permission: "product.edit",
    fromStatuses: ["Active", "Blocked"],
    targetStatus: "Obsolete",
    destructive: true,
  },
] as const;

export function allowedProductActions(
  status: ProductStatus,
  role: RoleName,
): readonly ProductAction[] {
  return PRODUCT_ACTIONS.filter((action) => {
    if (!action.fromStatuses.includes(status)) return false;
    if (!isBackendProductStatus(status)) return false;
    if (
      action.targetStatus &&
      (!isBackendProductStatus(action.targetStatus) ||
        !canTransition(PRODUCT_TRANSITIONS, status, action.targetStatus))
    ) {
      return false;
    }
    return can(role, action.permission);
  });
}

export function isSelfApproval(submittedBy: string | undefined, currentUserId: string | undefined) {
  return Boolean(submittedBy && currentUserId && submittedBy === currentUserId);
}

export function allowedSkuActions(status: SkuStatus, role: RoleName): readonly SkuAction[] {
  return SKU_ACTIONS.filter((action) => {
    if (!action.fromStatuses.includes(status)) return false;
    if (action.targetStatus && !canTransition(SKU_TRANSITIONS, status, action.targetStatus)) {
      return false;
    }
    return can(role, action.permission);
  });
}

export function isProductTerminal(status: ProductStatus): boolean {
  return isBackendProductStatus(status) ? isTerminal(PRODUCT_TRANSITIONS, status) : false;
}

export function isSkuTerminal(status: SkuStatus): boolean {
  return isTerminal(SKU_TRANSITIONS, status);
}

export function nextProductStatuses(status: ProductStatus): readonly ProductStatus[] {
  return isBackendProductStatus(status) ? allowedTransitions(PRODUCT_TRANSITIONS, status) : [];
}

function isBackendProductStatus(status: ProductStatus): status is BackendProductStatus {
  return status !== "Active" && status !== "Inactive";
}

export function nextSkuStatuses(status: SkuStatus): readonly SkuStatus[] {
  return allowedTransitions(SKU_TRANSITIONS, status);
}
