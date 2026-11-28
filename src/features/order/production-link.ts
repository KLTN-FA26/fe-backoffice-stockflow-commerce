import { ADMIN_ROUTES, PRODUCTION_ORDER_PERMISSIONS } from "@/constants";

import type { PermissionCode } from "@/lib/auth";

/**
 * Lối "Lập đơn sản xuất" từ chi tiết đơn bán: lịch sản xuất mở thẳng hộp Lập của đợt còn thiếu của đơn này. Chỉ người lập
 * được Đơn sản xuất thấy. UI-only — Backend phải re-check (production-orders:CREATE).
 */
export const drawUpHrefFor = (
  orderId: string,
  can: (code: PermissionCode) => boolean,
): string | undefined =>
  can(PRODUCTION_ORDER_PERMISSIONS.create)
    ? ADMIN_ROUTES.productionScheduleDrawUpFor(orderId)
    : undefined;
