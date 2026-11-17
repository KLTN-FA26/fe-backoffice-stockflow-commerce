"use client";

import { useState } from "react";
import { Ban, Check, X } from "lucide-react";

import { RETURN_LABELS } from "@/constants/labels-return";
import { RETURN_LIMITS } from "@/constants/returns";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { returnErrorMessage } from "../errors";
import { useCancelReturn, useRejectReturn } from "../mutations";

import { ApproveReturnDialog } from "./ApproveReturnDialog";

import type { ReturnAction } from "../lifecycle";
import type { ReturnRequest } from "../types";

const A = RETURN_LABELS.actions;
type Open = "approve" | "reject" | "cancel" | null;

/**
 * Nút quyết định của Sale trên một yêu cầu (đã lọc qua `allowedReturnActions` — trạng thái + quyền). Từ chối / rút
 * thay khách bắt buộc lý do (khách đọc được). Backend phải re-check (`sales-rmas:APPROVE` / `UPDATE`).
 */
export function ReturnActions({
  ret,
  actions,
}: {
  ret: ReturnRequest;
  actions: readonly ReturnAction[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const reject = useRejectReturn();
  const cancel = useCancelReturn();
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const onError = (failure: unknown) => setError(returnErrorMessage(failure));

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.includes("approve") && (
          <Button size="sm" onClick={() => setOpen("approve")}>
            <Check className="size-3.5" /> {A.approve}
          </Button>
        )}
        {actions.includes("reject") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("reject")}>
            <X className="size-3.5" /> {A.reject}
          </Button>
        )}
        {actions.includes("cancel") && (
          <Button size="sm" variant="outline" onClick={() => setOpen("cancel")}>
            <Ban className="size-3.5" /> {A.cancel}
          </Button>
        )}
      </div>
      <ApproveReturnDialog ret={open === "approve" ? ret : null} onClose={close} />
      <ConfirmDialog
        open={open === "reject"}
        onOpenChange={(next) => !next && close()}
        title={RETURN_LABELS.rejectDialog.title}
        description={RETURN_LABELS.rejectDialog.description}
        confirmLabel={RETURN_LABELS.rejectDialog.submit}
        requireReason
        reasonLabel={RETURN_LABELS.rejectDialog.reason}
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
      <ConfirmDialog
        open={open === "cancel"}
        onOpenChange={(next) => !next && close()}
        title={RETURN_LABELS.cancelDialog.title}
        description={RETURN_LABELS.cancelDialog.description}
        confirmLabel={RETURN_LABELS.cancelDialog.submit}
        requireReason
        reasonLabel={RETURN_LABELS.cancelDialog.reason}
        reasonMaxLength={RETURN_LIMITS.reasonMax}
        variant="danger"
        closeOnConfirm={false}
        loading={cancel.isPending}
        error={error}
        onConfirm={(reason) => cancel.mutate({ id: ret.id, reason }, { onSuccess: close, onError })}
      />
    </>
  );
}
