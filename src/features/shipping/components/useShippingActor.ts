import { hasPermission, useMyPermissions } from "@/lib/auth";

import type { ShippingActor } from "@/features/shipping/lifecycle";

/** Người đang đăng nhập dưới dạng `ShippingActor`: mã quyền + mã vai trò BE từ `/identity/me/permissions`. */
export function useShippingActor(): ShippingActor {
  const { data } = useMyPermissions();
  return { can: (code) => hasPermission(data, code), roles: data?.roles ?? [] };
}
