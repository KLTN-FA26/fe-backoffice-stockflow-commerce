"use client";

import { UI_LABELS } from "@/constants";
import { useAssignees } from "@/features/fulfillment/queries";
import { assigneeName } from "@/features/fulfillment/reference-api";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TitledSelectContent } from "@/components/shared/TitledSelectContent";

import { FieldError } from "../primitives";

const { fulfillment, loadError, common } = UI_LABELS;
export const SELECT_FIELD =
  "border-border-default bg-bg-surface mt-1 w-full rounded-[var(--r-sm)] text-[0.8125rem]";

/**
 * Chọn người được gán — danh sách do BE trả theo kho (`GET /fulfillment/assignees?warehouseId=`: nhân viên
 * kho / quản lý kho đang hoạt động của kho đó). Thiếu `fulfillment-task-assignment:UPDATE` → không gọi
 * API, hiện thông báo và dialog khoá nút gửi. Chưa biết kho (chưa chọn đơn) → nhắc chọn đơn trước.
 */
export function AssigneeSelect({
  canAssign,
  warehouseId,
  value,
  onChange,
  error,
  currentUserId,
  autoFocus,
}: {
  canAssign: boolean;
  /** Kho của task / đơn — BE trả người nhận theo kho. */
  warehouseId: string | null | undefined;
  value: string;
  onChange: (userId: string) => void;
  error: string | undefined;
  /** Người đang được gán — đánh dấu trong danh sách khi gán lại. */
  currentUserId?: string | null;
  autoFocus?: boolean;
}) {
  const users = useAssignees(warehouseId, canAssign);

  if (!canAssign) {
    return (
      <Alert tone="warning" title={fulfillment.noAssignTitle}>
        {fulfillment.noAssignDescription}
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
      <Select value={value} onValueChange={onChange} disabled={!warehouseId || users.isPending}>
        <SelectTrigger
          id="task-assignee"
          autoFocus={autoFocus}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "task-assignee-error" : undefined}
          className={SELECT_FIELD}
        >
          <SelectValue
            placeholder={
              !warehouseId
                ? "Chọn đơn hàng trước"
                : users.isPending
                  ? "Đang tải nhân viên…"
                  : options.length
                    ? "Chọn nhân viên kho"
                    : "Không có nhân viên kho đang hoạt động"
            }
          />
        </SelectTrigger>
        <TitledSelectContent title={fulfillment.field.assignee}>
          {options.map((user) => (
            <SelectItem key={user.userId} value={user.userId}>
              {assigneeName(user)}
              {user.userId === currentUserId && (
                <span className="text-ink-tertiary"> · đang được gán</span>
              )}
            </SelectItem>
          ))}
        </TitledSelectContent>
      </Select>
      <FieldError id="task-assignee-error">{error}</FieldError>
    </div>
  );
}
