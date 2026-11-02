/**
 * Action-gating cho thùng có LPN (SCRUM-473) — quyền + trạng thái thùng quyết định nút nào hiện.
 */

import { STOCK_PACKAGE_PERMISSIONS } from "@/constants";

import { liveCartons } from "./carton-selectors";

import type { PermissionCode } from "@/lib/auth";
import type { ReceiptLineDto } from "./types";

/**
 * In / in lại nhãn thùng: quyền `inventory-stock-packages:CREATE` (NV kho + Quản lý kho; Planner và NV QC chỉ xem —
 * seed V20261020000700) và dòng còn thùng RECEIVING / IN_STOCK (BE từ chối VOID / CONSUMED / LOST).
 * Backend phải re-check (StockPackageController#labels, `@RequiresPermission(CREATE)`).
 */
export function canPrintCartonLabels(
  line: Pick<ReceiptLineDto, "packages">,
  can: (code: PermissionCode) => boolean,
): boolean {
  return can(STOCK_PACKAGE_PERMISSIONS.create) && liveCartons(line).length > 0;
}
