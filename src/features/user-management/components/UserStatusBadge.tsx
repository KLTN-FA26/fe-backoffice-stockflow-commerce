import { StatusDot } from "@/components/shared/StatusDot";

import type { UserStatus } from "../types";

/** Trạng thái tài khoản — tone và nhãn từ `status-map.ts` (BE `UserStatus`), như mọi module khác. */
export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <StatusDot domain="customer" status={status} />;
}
