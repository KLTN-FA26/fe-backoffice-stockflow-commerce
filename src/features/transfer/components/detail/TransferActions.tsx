"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "cn";

import { ADMIN_ROUTES, TRANSFER_LIMITS, UI_LABELS } from "@/constants";
import { useAuthStore, usePermissionChecker } from "@/lib/auth";
import {
  TRANSFER_NO_ACTION_REASON,
  allowedTransferActions,
  dispatchExplanation,
  nextStepHint,
} from "@/features/transfer/lifecycle";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { DispatchDialog } from "./DispatchDialog";
import { TransferConfirmDialogs } from "./TransferConfirmDialogs";

import type { TransferActionCode } from "@/features/transfer/lifecycle";
import type { TransferOrder } from "@/features/transfer/types";

const L = UI_LABELS.transfer;
const BUTTON_BASE =
  "h-(--action-h) w-full rounded-(--action-radius) border px-3 text-[0.8125rem] font-medium";
const TONE_CLASS = {
  primary:
    "border-border-default bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse",
  // `dark:` lặp lại vì variant outline có `dark:bg-input/30 dark:border-input` đè màu ở dark mode
  secondary:
    "border-border-strong bg-bg-surface text-ink-primary hover:bg-bg-muted dark:border-border-strong dark:bg-bg-surface dark:hover:bg-bg-muted",
  danger:
    "border-danger text-danger hover:bg-danger/10 hover:text-danger bg-transparent dark:border-danger dark:bg-transparent dark:hover:bg-danger/10",
} as const;

/**
 * Card thao tác cột phải: nút theo `allowedTransferActions` (không rải if/else trong JSX).
 * Mọi thao tác qua dialog xác nhận; đang chạy → khoá nút, chặn bấm hai lần.
 */
export function TransferActions({ transfer }: { transfer: TransferOrder }) {
  const router = useRouter();
  const can = usePermissionChecker();
  const currentUserId = useAuthStore((state) => state.user?.userId);
  const [dialog, setDialog] = useState<TransferActionCode | null>(null);
  const actions = allowedTransferActions(transfer, can, currentUserId);
  const showAutoApproveHint = actions.some(({ action }) => action.code === "submit");

  const explanation = dispatchExplanation(transfer, can);
  const nextHint = nextStepHint(transfer);

  // Sửa nháp, đóng gói và lập kế hoạch xe là màn khác (không phải hộp thoại xác nhận)
  const open = (code: TransferActionCode) => {
    if (code === "edit") router.push(ADMIN_ROUTES.transfers.edit(transfer.transferId));
    else if (code === "packTransfer" || code === "viewPacking")
      router.push(ADMIN_ROUTES.packing.transfer(transfer.transferId));
    else if (code === "planVehicle")
      router.push(
        ADMIN_ROUTES.loadPlans.createFromTransfer(transfer.transferId, transfer.fromWarehouseId),
      );
    else setDialog(code);
  };

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)] shadow-(--card-shadow)">
      <div className="mb-4 flex justify-center">
        <StatusDot domain="to" status={transfer.status} size="md" withIcon />
      </div>
      <div className="space-y-2">
        {actions.map(({ action, disabledReason }) => (
          <div key={action.code}>
            <Button
              type="button"
              // outline có `dark:bg-input/30` đè nền brand ở dark mode → nút chính dùng default
              variant={action.tone === "primary" ? "default" : "outline"}
              size="sm"
              disabled={!!disabledReason}
              onClick={() => open(action.code)}
              className={cn(BUTTON_BASE, TONE_CLASS[action.tone])}
            >
              {action.label}
            </Button>
            {disabledReason && (
              <p className="text-ink-tertiary mt-1 text-center text-xs">{disabledReason}</p>
            )}
          </div>
        ))}
        {actions.length === 0 && !explanation && (
          <p className="text-ink-tertiary text-center text-xs">
            {TRANSFER_NO_ACTION_REASON[transfer.status]}
          </p>
        )}
        {explanation && <p className="text-ink-tertiary text-center text-xs">{explanation}</p>}
        {nextHint &&
          actions.some(
            ({ action }) => action.code === "planVehicle" || action.code === "packTransfer",
          ) && <p className="text-ink-tertiary text-center text-xs">{nextHint}</p>}
        {showAutoApproveHint && (
          <p className="text-ink-tertiary text-center text-xs">
            {L.autoApproveHint} (≤ {TRANSFER_LIMITS.approvalThresholdUnits} {L.unit}).
          </p>
        )}
      </div>
      {dialog === "dispatch" && (
        <DispatchDialog transfer={transfer} open onClose={() => setDialog(null)} />
      )}
      <TransferConfirmDialogs transfer={transfer} dialog={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
