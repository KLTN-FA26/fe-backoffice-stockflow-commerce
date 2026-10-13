/**
 * Biến thể — vòng đời + gate thao tác theo mã quyền thật (BE `VariantStatus#canTransitionTo`,
 * `ProductVariantController` @RequiresPermission). UI-only: BE kiểm lại và trả 409.
 *
 *   DRAFT → ACTIVE (kích hoạt, cần sản phẩm đã duyệt — BE tự kích hoạt các biến thể Nháp lúc duyệt
 *           sản phẩm) | OBSOLETE
 *   ACTIVE → BLOCKED (tạm chặn) | OBSOLETE
 *   BLOCKED → ACTIVE | OBSOLETE
 *   OBSOLETE: kết thúc. Biến thể mặc định không ngừng dùng riêng (ngừng kinh doanh sản phẩm).
 */
import { PRODUCT_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";
import type { VariantTransition } from "./variant-api";
import type { Variant, VariantStatus } from "./variant-schemas";

export interface VariantAction {
  readonly code: VariantTransition;
  readonly label: string;
  readonly permission: PermissionCode;
  readonly fromStatuses: readonly VariantStatus[];
  readonly destructive?: boolean;
}

export const VARIANT_ACTIONS: readonly VariantAction[] = [
  {
    code: "activate",
    label: "Kích hoạt",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["DRAFT", "BLOCKED"],
  },
  {
    code: "block",
    label: "Tạm chặn",
    permission: PRODUCT_PERMISSIONS.update,
    fromStatuses: ["ACTIVE"],
    destructive: true,
  },
  {
    code: "obsolete",
    label: "Ngừng dùng",
    permission: PRODUCT_PERMISSIONS.approve,
    fromStatuses: ["DRAFT", "ACTIVE", "BLOCKED"],
    destructive: true,
  },
];

/** @param productApproved sản phẩm đã duyệt / đang bán — BE từ chối kích hoạt khi chưa (409). */
export function allowedVariantActions(
  variant: Pick<Variant, "status" | "defaultVariant">,
  can: (code: PermissionCode) => boolean,
  productApproved = true,
): readonly VariantAction[] {
  return VARIANT_ACTIONS.filter(
    (action) =>
      action.fromStatuses.includes(variant.status) &&
      !(action.code === "obsolete" && variant.defaultVariant) &&
      !(action.code === "activate" && !productApproved) &&
      can(action.permission),
  );
}

/** Đếm theo trạng thái cho thẻ tổng quan. */
export function countVariantsByStatus(variants: readonly Variant[]): Record<VariantStatus, number> {
  const counts: Record<VariantStatus, number> = { DRAFT: 0, ACTIVE: 0, BLOCKED: 0, OBSOLETE: 0 };
  for (const v of variants) counts[v.status] += 1;
  return counts;
}
