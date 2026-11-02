/**
 * Key cache liên module — feature phát sinh thay đổi invalidate root ở đây thay vì import
 * `features/<khác>` (feature-architecture.md: cấm import chéo feature).
 */

import { SHARED_QUERY_ROOTS } from "@/constants";

export const inventoryStockKeys = {
  all: [SHARED_QUERY_ROOTS.inventoryStock] as const,
};

export const inventoryReservationKeys = {
  all: [SHARED_QUERY_ROOTS.inventoryReservations] as const,
};

/** Thao tác đổi giữ chỗ (huỷ / release / từ chối công nợ) → tồn + phiếu giữ hàng phải tải lại. */
export const RESERVATION_CHANGE_INVALIDATIONS = [
  inventoryStockKeys.all,
  inventoryReservationKeys.all,
] as const;
