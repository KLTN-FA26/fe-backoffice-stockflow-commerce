import { FULFILLMENT_PICK_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { hasPermission, useAuthStore, useMyPermissions } from "@/lib/auth";
import { useOrderNumbers } from "@/features/fulfillment/queries";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";

/**
 * Người đang đăng nhập dưới dạng `FulfillmentActor`: mã quyền (`/identity/me/permissions`) + userId để so với người được gán.
 */
export function useFulfillmentActor(): FulfillmentActor {
  const { data } = useMyPermissions();
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  return { can: (code) => hasPermission(data, code), userId };
}

/**
 * Tra số đơn cho các màn task (BE chỉ trả id đơn). Chỉ gọi khi người dùng có quyền đọc đơn; thiếu quyền →
 * bản đồ rỗng, màn hiện id rút gọn. Tên người được gán đã nằm trên task (`assignedUserName`).
 */
export function useTaskReferences(actor: FulfillmentActor) {
  const canReadTasks = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const canReadOrders = actor.can(ORDER_PERMISSIONS.read);
  const orderNumbers = useOrderNumbers(canReadTasks && canReadOrders).data;
  return { canReadOrders, orderNumbers };
}

export type TaskReferences = ReturnType<typeof useTaskReferences>;
