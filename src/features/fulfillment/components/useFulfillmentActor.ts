import {
  FULFILLMENT_PICK_PERMISSIONS,
  IDENTITY_USER_PERMISSIONS,
  ORDER_PERMISSIONS,
} from "@/constants";
import { hasPermission, useAuthStore, useMyPermissions } from "@/lib/auth";
import { useAssignableUsers, useOrderNumbers } from "@/features/fulfillment/queries";
import { userDisplayName } from "@/features/fulfillment/reference-api";

import type { FulfillmentActor } from "@/features/fulfillment/lifecycle";

/**
 * Người đang đăng nhập dưới dạng `FulfillmentActor`: mã quyền + mã vai trò BE (cùng một response
 * `/identity/me/permissions`) + userId để so với người được gán.
 */
export function useFulfillmentActor(): FulfillmentActor {
  const { data } = useMyPermissions();
  const userId = useAuthStore((s) => s.user?.userId ?? null);
  return { can: (code) => hasPermission(data, code), roles: data?.roles ?? [], userId };
}

/**
 * Tra số đơn và tên người được gán cho các màn task (BE chỉ trả id). Mỗi nguồn chỉ gọi khi người
 * dùng có quyền đọc module đó; thiếu quyền → bản đồ rỗng, màn hiện id rút gọn.
 */
export function useTaskReferences(actor: FulfillmentActor) {
  const canReadTasks = actor.can(FULFILLMENT_PICK_PERMISSIONS.read);
  const canReadOrders = actor.can(ORDER_PERMISSIONS.read);
  const canReadUsers = actor.can(IDENTITY_USER_PERMISSIONS.read);
  const orderNumbers = useOrderNumbers(canReadTasks && canReadOrders).data;
  const users = useAssignableUsers(canReadTasks && canReadUsers).data;
  const userNames: Readonly<Record<string, string>> = Object.fromEntries(
    (users ?? []).map((user) => [user.userId, userDisplayName(user)]),
  );
  return { canReadOrders, canReadUsers, orderNumbers, userNames };
}

export type TaskReferences = ReturnType<typeof useTaskReferences>;
