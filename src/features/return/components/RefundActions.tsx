"use client";

import { useState } from "react";
import { BadgeCheck, CornerUpLeft, HandCoins } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { formatMoney } from "@/lib/format";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { returnErrorMessage } from "../errors";
import { useApproveSettlement, useRejectSettlement } from "../mutations";

import { ProposeRefundDialog } from "./ProposeRefundDialog";

import type { ReturnAction } from "../lifecycle";
import type { ReturnRequest } from "../types";

const A = RETURN_LABELS.actions;
type Open = "propose" | "approve" | "reject" | null;

/**
 * Hoàn tiền của yêu cầu trả hàng (docs 17 §4.10 bước 40, 15 §4.5): Sale đề xuất khi hàng đã về (RECEIVED); Kế toán duyệt
 * hoặc trả lại đề xuất (SETTLEMENT_PENDING) — không phải người đề xuất (BE `RETURN_SELF_APPROVAL`). Duyệt xong số phải
 * chuyển trả hiện ở màn Hoàn tiền để Kế toán ghi nhận. Backend phải re-check (`sales-rma-resolutions`).
 */
export function RefundActions({
  ret,
  actions,
}: {
  ret: ReturnRequest;
  actions: readonly ReturnAction[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const approve = useApproveSettlement();
  const reject = useRejectSettlement();
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const onError = (failure: unknown) => setError(returnErrorMessage(failure));
  const amount = ret.resolution?.settlementAmount;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.includes("propose") && (
          <Button size="sm" onClick={() => setOpen("propose")}>
            <HandCoins className="size-3.5" /> {A.propose}
          </Button>
        )}
        {actions.includes("approveSettlement") && (
          <Button size="sm" onClick={() => setOpen("approve")}>
            <BadgeCheck className="size-3.5" /> {A.approveSettlement}
          </Button>
        )}
        {actions.includes("rejectSettlement") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("reject")}>
            <CornerUpLeft className="size-3.5" /> {A.rejectSettlement}
          </Button>
        )}
      </div>
      <ProposeRefundDialog ret={open === "propose" ? ret : null} onClose={close} />
      <ConfirmDialog
        open={open === "approve"}
        onOpenChange={(next) => !next && close()}
        title={`${RETURN_LABELS.approveSettlementDialog.title}${
          amount != null ? ` ${formatMoney(amount, ret.currency)}` : ""
        }`}
        description={RETURN_LABELS.approveSettlementDialog.description}
        confirmLabel={RETURN_LABELS.approveSettlementDialog.submit}
        closeOnConfirm={false}
        loading={approve.isPending}
        error={error}
        onConfirm={() =>
          approve.mutate({ id: ret.id, version: ret.version }, { onSuccess: close, onError })
        }
      />
      <ConfirmDialog
        open={open === "reject"}
        onOpenChange={(next) => !next && close()}
        title={RETURN_LABELS.rejectSettlementDialog.title}
        description={RETURN_LABELS.rejectSettlementDialog.description}
        confirmLabel={RETURN_LABELS.rejectSettlementDialog.submit}
        requireReason
        reasonLabel={RETURN_LABELS.rejectSettlementDialog.reason}
        reasonMaxLength={RETURN_LIMITS.reasonMax}
        variant="danger"
        closeOnConfirm={false}
        loading={reject.isPending}
        error={error}
        onConfirm={(reason) =>
          reject.mutate(
            { id: ret.id, version: ret.version, reason: reason ?? "" },
            { onSuccess: close, onError },
          )
        }
      />
    </>
  );
}
