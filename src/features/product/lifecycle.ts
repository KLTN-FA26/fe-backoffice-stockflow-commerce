/**
 * Product — lifecycle & action-gating.
 *
 * Source: docs/warehouse/01-product-creation §5 + §6. Biến thể: `variant-lifecycle.ts` (BE PR #71).
 */

import { PRODUCT_PERMISSIONS } from "@/constants/permissions";

import { allowedTransitions, canTransition, isTerminal } from "@/lib/domain/lifecycle";

import type { PermissionCode } from "@/lib/auth/me-permissions";
import type { ProductStatus } from "./types";

export { allowedTransitions, canTransition, isTerminal };

/** "Active" là trạng thái legacy của mock cũ; "UNKNOWN" là trạng thái BE chưa biết — đều không có chuyển tiếp. */
export type BackendProductStatus = Exclude<ProductStatus, "Active" | "UNKNOWN">;

/**
 * Exact ProductStatus state machine from backend develop (`ProductStatus#canTransitionTo`).
 * Inactive = tạm ngưng: `POST /suspension` (Approved | Published → Inactive, cần lý do) và
 * `POST /resumption` (Inactive → Approved; muốn lên cửa hàng phải xuất bản lại).
 */
export const PRODUCT_TRANSITIONS: Record<BackendProductStatus, readonly BackendProductStatus[]> = {
  Draft: ["Pending Approval"],
  "Pending Approval": ["Approved", "Draft"],
  Approved: ["Published", "Discontinued", "Inactive"],
  Published: ["Approved", "Discontinued", "Inactive"],
  Inactive: ["Approved", "Discontinued"],
  Discontinued: [],
};

export interface ProductAction {
  readonly code: string;
  readonly label: string;
  readonly permission: PermissionCode;
  readonly fromStatuses: readonly ProductStatus[];
  readonly targetStatus?: ProductStatus;
  readonly transition?:
    | "submit"
    | "approve"
    | "reject"
    | "discontinue"
    | "publish"
    | "unpublish"
    | "suspend"
    | "resume"
    | "delete";
  readonly destructive?: boolean;
}

export const PRODUCT_ACTIONS: readonly ProductAction[] = [
  {
    code: "edit",
    label: "Chỉnh sửa",
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: ["Draft"],
  },
  // docs §4.8: Submit for review → Pending Approval.
  {
    code: "submit",
    label: "Gửi duyệt",
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: ["Draft"],
    targetStatus: "Pending Approval",
    transition: "submit",
  },
  // docs §4.9: Approve → Approved; reject returns Draft.
  {
    code: "approve",
    label: "Phê duyệt",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Pending Approval"],
    targetStatus: "Approved",
    transition: "approve",
  },
  {
    code: "reject",
    label: "Từ chối",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Pending Approval"],
    targetStatus: "Draft",
    transition: "reject",
    destructive: true,
  },
  {
    code: "publish",
    label: "Xuất bản",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Approved"],
    targetStatus: "Published",
    transition: "publish",
  },
  {
    code: "unpublish",
    label: "Gỡ xuất bản",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Published"],
    targetStatus: "Approved",
    transition: "unpublish",
  },
  // BE `ProductController`: tạm ngưng / tiếp tục / ngừng kinh doanh đều là product-products:APPROVE
  // (docs 01 §5.1 giao cho System Admin; BE cho cả vai trò giữ quyền APPROVE). Backend phải re-check.
  {
    code: "suspend",
    label: "Tạm ngưng",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Approved", "Published"],
    targetStatus: "Inactive",
    transition: "suspend",
    destructive: true,
  },
  {
    code: "resume",
    label: "Tiếp tục kinh doanh",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Inactive"],
    targetStatus: "Approved",
    transition: "resume",
  },
  {
    code: "discontinue",
    label: "Ngừng kinh doanh",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["Approved", "Published", "Inactive"],
    targetStatus: "Discontinued",
    transition: "discontinue",
    destructive: true,
  },
  // BR-02 (docs 01 §6): sản phẩm đã gửi duyệt không xoá, chỉ Inactive / Discontinued; BE
  // `Product.requireDeletable` chỉ cho xoá DRAFT. Quyền DELETE riêng, tách khỏi APPROVE.
  {
    code: "delete",
    label: "Xoá sản phẩm",
    permission: PRODUCT_PERMISSIONS.delete,
    fromStatuses: ["Draft"],
    transition: "delete",
    destructive: true,
  },
] as const;

export function allowedProductActions(
  status: ProductStatus,
  can: (permission: PermissionCode) => boolean,
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
    return can(action.permission);
  });
}

export function isSelfApproval(submittedBy: string | undefined, currentUserId: string | undefined) {
  return Boolean(submittedBy && currentUserId && submittedBy === currentUserId);
}

export function isProductTerminal(status: ProductStatus): boolean {
  return isBackendProductStatus(status) ? isTerminal(PRODUCT_TRANSITIONS, status) : false;
}

export function nextProductStatuses(status: ProductStatus): readonly ProductStatus[] {
  return isBackendProductStatus(status) ? allowedTransitions(PRODUCT_TRANSITIONS, status) : [];
}

function isBackendProductStatus(status: ProductStatus): status is BackendProductStatus {
  return status !== "Active" && status !== "UNKNOWN";
}
