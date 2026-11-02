"use client";

import { useRef, useState } from "react";

import { INVENTORY_LABELS, INVENTORY_LIMITS, STOCK_ADJUSTMENT_ACTION } from "@/constants/inventory";

import { usePermissionChecker } from "@/lib/auth";
import { useAuthStore } from "@/lib/auth/auth-store";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { inventoryErrorView } from "../errors";
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
  const userId = useAuthStore((state) => state.user?.userId);
  const can = usePermissionChecker();
  const actions = allowedAdjustmentActions(adjustment.status, can, userId, adjustment.requestedBy);
  const approve = useApproveAdjustment();
  const reject = useRejectAdjustment();
  const withdraw = useWithdrawAdjustment();
  const pending = approve.isPending || reject.isPending || withdraw.isPending;
  const [action, setAction] = useState<(typeof actions)[number] | null>(null);
  const [error, setError] = useState<{ detail: string; traceId?: string } | null>(null);
  // `pending` is a render snapshot: a second confirm in the same frame would still see false.
  const running = useRef(false);
  const confirm = async (reason?: string) => {
    if (running.current || pending || !action || !actions.includes(action)) return;
    running.current = true;
    setError(null);
    try {
      if (action === STOCK_ADJUSTMENT_ACTION.APPROVE)
        await approve.mutateAsync(adjustment.adjustmentId);
      if (action === STOCK_ADJUSTMENT_ACTION.WITHDRAW)
        await withdraw.mutateAsync(adjustment.adjustmentId);
      if (action === STOCK_ADJUSTMENT_ACTION.REJECT) {
        const input = adjustmentRejectionInput.safeParse({ reason });
        if (!input.success) {
          // Dialog stays open with the typed reason (closeOnConfirm={false}).
          setError({ detail: input.error.issues[0]?.message ?? INVENTORY_LABELS.rejectionReason });
          return;
        }
        await reject.mutateAsync({ id: adjustment.adjustmentId, input: input.data });
      }
      // Only a confirmed success closes the dialog.
      setAction(null);
    } catch (failure: unknown) {
      // Stale-state codes already refetched the detail in the mutation (mutations.ts).
      const view = inventoryErrorView(failure);
      setError({ detail: view.detail, traceId: view.traceId });
    } finally {
      running.current = false;
    }
  };
  // An action that a refetch made unavailable (stale conflict) drops its dialog.
  const dialogAction = action && actions.includes(action) ? action : null;
  const errorView = error && (
    <>
      <p>{error.detail}</p>
      {error.traceId && (
        <p>
          {INVENTORY_LABELS.trace}: {error.traceId}
        </p>
      )}
    </>
  );
  return (
    <div className="space-y-[var(--el-gap)]">
      <div className="flex gap-[var(--el-gap)]">
        {actions.map((value) => (
          <Button
            className="h-(--action-h) rounded-(--action-radius) px-(--action-px)"
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
      {/* While the modal is open the page behind it is hidden from assistive tech, so the
          error lives in the dialog; once it closes (stale action) it is shown here. */}
      {errorView && !dialogAction && (
        <div role="alert" className="text-danger">
          {errorView}
        </div>
      )}
      {dialogAction && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setAction(null);
              setError(null);
            }
          }}
          title={actionLabels[dialogAction]}
          description={actionDescriptions[dialogAction]}
          confirmLabel={actionLabels[dialogAction]}
          cancelLabel={INVENTORY_LABELS.cancel}
          requireReason={dialogAction === STOCK_ADJUSTMENT_ACTION.REJECT}
          reasonLabel={INVENTORY_LABELS.rejectionReason}
          reasonMaxLength={INVENTORY_LIMITS.rejectionLength}
          loading={pending}
          closeOnConfirm={false}
          error={errorView}
          variant={dialogAction === STOCK_ADJUSTMENT_ACTION.APPROVE ? "default" : "danger"}
          onConfirm={(reason) => void confirm(reason)}
        />
      )}
    </div>
  );
}
