"use client";

import { UI_LABELS } from "@/constants";
import { useAssignableUsers } from "@/features/fulfillment/queries";
import { userDisplayName } from "@/features/fulfillment/reference-api";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { FieldError } from "../primitives";

const { fulfillment, loadError, common } = UI_LABELS;
export const SELECT_FIELD =
  "border-border-default bg-bg-surface mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Chọn người được gán — nhân viên kho / quản lý kho đang hoạt động (BE `requireWarehouseAssignee`).
 * Thiếu `identity-users:READ` (seed BE chưa cấp cho điều phối / quản lý kho) → không gọi API,
 * hiện thông báo và dialog khoá nút gửi.
 */
export function AssigneeSelect({
  canReadUsers,
  value,
  onChange,
  error,
  currentUserId,
  autoFocus,
}: {
  canReadUsers: boolean;
  value: string;
  onChange: (userId: string) => void;
  error: string | undefined;
  /** Người đang được gán — đánh dấu trong danh sách khi gán lại. */
  currentUserId?: string | null;
  autoFocus?: boolean;
}) {
  const users = useAssignableUsers(canReadUsers);

  if (!canReadUsers) {
    return (
      <Alert tone="warning" title={fulfillment.noUserReadTitle}>
        {fulfillment.noUserReadDescription}
      </Alert>
    );
  }
  if (users.isError) {
    return (
      <Alert tone="danger" title={loadError.serverTitle}>
        Không tải được danh sách nhân viên.{" "}
        <Button
          type="button"
          variant="link"
          size="xs"
          className="h-auto p-0 align-baseline"
          onClick={() => void users.refetch()}
        >
          {common.retry}
        </Button>
      </Alert>
    );
  }
  const options = users.data ?? [];
  return (
    <div>
      <Label htmlFor="task-assignee" className="text-[0.8125rem]">
        {fulfillment.field.assignee}
      </Label>
      <Select value={value} onValueChange={onChange} disabled={users.isPending}>
        <SelectTrigger
          id="task-assignee"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-assignee-error" : undefined}
          className={SELECT_FIELD}
        >
          <SelectValue
            placeholder={
              users.isPending
                ? "Đang tải nhân viên…"
                : options.length
                  ? "Chọn nhân viên kho"
                  : "Không có nhân viên kho đang hoạt động"
            }
          />
        </SelectTrigger>
        <SelectContent>
          {options.map((user) => (
            <SelectItem key={user.userId} value={user.userId}>
              {userDisplayName(user)}
              {user.userId === currentUserId && (
                <span className="text-ink-tertiary"> · đang được gán</span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldError id="task-assignee-error">{error}</FieldError>
    </div>
  );
}
