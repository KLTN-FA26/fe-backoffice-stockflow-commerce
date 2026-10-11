"use client";

import { useState } from "react";

import { INVENTORY_LABELS, STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";

import { useAuthStore } from "@/lib/auth/auth-store";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { allowedAdjustmentActions } from "../lifecycle";
import { useApproveAdjustment, useRejectAdjustment, useWithdrawAdjustment } from "../mutations";
import { adjustmentRejectionInput } from "../schemas";

import type { StockAdjustment } from "../types";

const actionLabels = {
  [STOCK_ADJUSTMENT_ACTION.APPROVE]: INVENTORY_LABELS.approve,
  [STOCK_ADJUSTMENT_ACTION.REJECT]: INVENTORY_LABELS.reject,
  [STOCK_ADJUSTMENT_ACTION.WITHDRAW]: INVENTORY_LABELS.withdraw,
};
const actionDescriptions = {
  [STOCK_ADJUSTMENT_ACTION.APPROVE]: INVENTORY_LABELS.approveDescription,
  [STOCK_ADJUSTMENT_ACTION.REJECT]: INVENTORY_LABELS.rejectDescription,
  [STOCK_ADJUSTMENT_ACTION.WITHDRAW]: INVENTORY_LABELS.withdrawDescription,
};

export function AdjustmentActions({ adjustment }: { adjustment: StockAdjustment }) {
  const auth = useAuthStore();
  const actions = allowedAdjustmentActions(
    adjustment.status,
    auth.effectiveRoles(),
    auth.user?.userId,
    adjustment.requestedBy,
  );
  const approve = useApproveAdjustment();
  const reject = useRejectAdjustment();
  const withdraw = useWithdrawAdjustment();
  const pending = approve.isPending || reject.isPending || withdraw.isPending;
  const [action, setAction] = useState<(typeof actions)[number] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const confirm = async (reason?: string) => {
    if (pending || !action || !actions.includes(action)) return;
    setError(null);
    try {
      if (action === STOCK_ADJUSTMENT_ACTION.APPROVE)
        await approve.mutateAsync(adjustment.adjustmentId);
      if (action === STOCK_ADJUSTMENT_ACTION.WITHDRAW)
        await withdraw.mutateAsync(adjustment.adjustmentId);
      if (action === STOCK_ADJUSTMENT_ACTION.REJECT) {
        const input = adjustmentRejectionInput.safeParse({ reason });
        if (!input.success) {
          setError(input.error.issues[0]?.message ?? INVENTORY_LABELS.rejectionReason);
          return;
        }
        await reject.mutateAsync({ id: adjustment.adjustmentId, input: input.data });
      }
    } catch (failure: unknown) {
      setError(failure instanceof Error ? failure.message : INVENTORY_LABELS.loadError);
    }
  };
  return (
    <div className="space-y-[var(--el-gap)]">
      <div className="flex gap-[var(--el-gap)]">
        {actions.map((value) => (
          <Button
            className="rounded-[var(--r-sm)]"
            key={value}
            type="button"
            disabled={pending}
            variant={value === STOCK_ADJUSTMENT_ACTION.APPROVE ? "default" : "outline"}
            onClick={() => setAction(value)}
          >
            {actionLabels[value]}
          </Button>
        ))}
      </div>
      {pending && <p role="status">{INVENTORY_LABELS.submitting}</p>}
      {error && (
        <p role="alert" className="text-danger">
          {error}
        </p>
      )}
      {action && (
        <ConfirmDialog
          open={Boolean(action)}
          onOpenChange={(open) => {
            if (!open) setAction(null);
          }}
          title={actionLabels[action]}
          description={actionDescriptions[action]}
          confirmLabel={actionLabels[action]}
          cancelLabel={INVENTORY_LABELS.cancel}
          requireReason={action === STOCK_ADJUSTMENT_ACTION.REJECT}
          reasonLabel={INVENTORY_LABELS.rejectionReason}
          variant={action === STOCK_ADJUSTMENT_ACTION.APPROVE ? "default" : "danger"}
          onConfirm={(reason) => void confirm(reason)}
        />
      )}
    </div>
  );
}
