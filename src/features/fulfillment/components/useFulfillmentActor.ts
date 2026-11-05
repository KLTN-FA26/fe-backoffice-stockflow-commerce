import { hasPermission, useAuthStore, useMyPermissions } from "@/lib/auth";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";

/**
 * Người đang đăng nhập dưới dạng `FulfillmentActor`: mã quyền (`/identity/me/permissions`) + userId để so với người được gán.
 * Số đơn, tên người được gán và dòng hàng đã nằm trên task (SCRUM-466) — màn task không tra module khác.
 */
export function useFulfillmentActor(): FulfillmentActor {
  const { data } = useMyPermissions();
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  return { can: (code) => hasPermission(data, code), userId };
}
