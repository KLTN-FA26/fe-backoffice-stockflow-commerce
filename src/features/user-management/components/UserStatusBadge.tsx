import { cn } from "cn";

import { USER_STATUS_LABELS } from "@/constants";

import type { UserStatus } from "../types";

const DOT: Record<UserStatus, string> = {
  ACTIVE: "bg-dot-positive",
  LOCKED: "bg-dot-warning",
  DISABLED: "bg-muted-tone",
};

/** Trạng thái tài khoản — nhãn tiếng Việt kèm chấm màu; màu không là tín hiệu duy nhất. */
export function UserStatusBadge({ status, className }: { status: UserStatus; className?: string }) {
  return (
    <span
      className={cn(
        "text-ink-primary inline-flex items-center gap-1.5 text-[0.8125rem]",
        className,
      )}
    >
      <span aria-hidden className={cn("size-2 rounded-full", DOT[status])} />
      {USER_STATUS_LABELS[status]}
    </span>
  );
}
