"use client";

import { cn } from "cn";

import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { PoAction, PoStatus } from "@/features/purchase-order";
import { isPoTerminal } from "@/features/purchase-order/lifecycle";

export function PoActionPanel({
  status,
  actions,
  isMutating,
  conflictError,
  onAction,
}: {
  status: string;
  actions: readonly PoAction[];
  isMutating: boolean;
  conflictError: string | null;
  onAction: (act: PoAction) => void;
}) {
  const terminal = isPoTerminal(status as PoStatus);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="po" status={status as never} size="md" withIcon />
      </div>
      {actions.length > 0 && (
        <div className="space-y-2">
          {conflictError && (
            <div className="border-danger/30 bg-danger/5 text-danger rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]">
              {conflictError}
            </div>
          )}
          {actions.map((act) => (
            <Button
              key={act.code}
              type="button"
              variant="outline"
              size="sm"
              aria-label={act.label}
              disabled={isMutating}
              onClick={() => onAction(act)}
              className={cn(
                "w-full rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem] font-medium transition-colors",
                act.destructive
                  ? "border-danger text-danger hover:bg-danger/10 bg-transparent"
                  : "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
              )}
            >
              {act.label}
            </Button>
          ))}
        </div>
      )}
      {terminal && (
        <p className="text-ink-tertiary text-center text-xs">
          Trạng thái kết thúc — không có hành động khả dụng.
        </p>
      )}
    </section>
  );
}

export function actionDescription(act: PoAction, currentStatus: string): string {
  if (act.code === "cancel")
    return `Huỷ PO — đơn sẽ chuyển sang "CANCELLED" từ "${currentStatus}". Không thể khôi phục.`;
  if (act.code === "closeShort")
    return `Đóng thiếu — PO sẽ chuyển sang "CLOSED_SHORT". Phần còn lại được ghi nhận thiếu.`;
  if (act.code === "receive") return `Nhận hàng — ghi nhận số lượng đã nhận cho từng dòng.`;
  return `Xác nhận thực hiện "${act.label}".`;
}
