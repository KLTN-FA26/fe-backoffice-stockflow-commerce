import { INVENTORY_ITEM_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth/me-permissions";

/**
 * Hồ sơ hàng tồn không có vòng đời trạng thái — chỉ gate theo quyền.
 * UI-only: Backend phải re-check (BE PR #119).
 */
export function inventoryItemCapabilities(can: (p: PermissionCode) => boolean): {
  canView: boolean;
  canRead: boolean;
  canEdit: boolean;
} {
  return {
    canView: can(INVENTORY_ITEM_PERMISSIONS.viewPage),
    canRead: can(INVENTORY_ITEM_PERMISSIONS.read),
    canEdit: can(INVENTORY_ITEM_PERMISSIONS.update),
  };
}
