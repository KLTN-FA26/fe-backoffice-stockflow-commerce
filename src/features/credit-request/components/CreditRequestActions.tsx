"use client";

import { useState } from "react";
import { CheckCircle2, MessageSquareText, Undo2, XCircle } from "lucide-react";

import { CREDIT_REQUEST_LIMITS } from "@/constants/credit-request";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import {
  creditRequestErrorMessage,
  useRejectCreditRequest,
  useWithdrawCreditRequest,
} from "../mutations";

import { ApproveDialog } from "./ApproveDialog";
import { RecommendDialog } from "./RecommendDialog";

import type { CreditRequestAction } from "../lifecycle";
import type { CreditRequest } from "../types";

type Open = "recommend" | "approve" | "reject" | "withdraw" | null;

/** Nút của đề nghị theo `allowedCreditRequestActions` — việc chính trước, từ chối (nguy hiểm) cuối. */
export function CreditRequestActions({
  request,
  actions,
}: {
  request: CreditRequest;
  actions: readonly CreditRequestAction[];
}) {
  const [open, setOpen] = useState<Open>(null);
  const [error, setError] = useState<string | null>(null);
  const reject = useRejectCreditRequest();
  const withdraw = useWithdrawCreditRequest();
  const close = () => {
    setOpen(null);
    setError(null);
  };
  const onError = (e: unknown) => setError(creditRequestErrorMessage(e));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.includes("recommend") && (
        <Button size="sm" onClick={() => setOpen("recommend")}>
          <MessageSquareText className="size-3.5" /> Ghi ý kiến
        </Button>
      )}
      {actions.includes("approve") && request.review && (
        <Button size="sm" onClick={() => setOpen("approve")}>
          <CheckCircle2 className="size-3.5" /> Duyệt
        </Button>
      )}
      {actions.includes("withdraw") && (
        <Button size="sm" variant="outline" onClick={() => setOpen("withdraw")}>
          <Undo2 className="size-3.5" /> Rút đề nghị
        </Button>
      )}
      {actions.includes("reject") && (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => setOpen("reject")}
        >
          <XCircle className="size-3.5" /> Từ chối
        </Button>
      )}

      {open === "recommend" && <RecommendDialog request={request} onClose={close} />}
      {open === "approve" && request.review && (
        <ApproveDialog request={request} review={request.review} onClose={close} />
      )}
      <ConfirmDialog
        open={open === "reject"}
        onOpenChange={(next) => !next && close()}
        title="Từ chối đề nghị cấp hạn mức?"
        description="Hạn mức của khách giữ nguyên. Khách thấy lý do bạn ghi."
        confirmLabel="Từ chối"
        requireReason
        reasonLabel="Lý do từ chối"
        reasonMaxLength={CREDIT_REQUEST_LIMITS.textMax}
        loading={reject.isPending}
        closeOnConfirm={false}
        error={error ?? undefined}
        onConfirm={(reason) =>
          reject.mutate(
            { id: request.id, version: request.version, reason: (reason ?? "").trim() },
            { onSuccess: close, onError },
          )
        }
      />
      <ConfirmDialog
        open={open === "withdraw"}
        onOpenChange={(next) => !next && close()}
        title="Rút đề nghị?"
        description="Đề nghị kết thúc ở trạng thái Đã rút. Muốn xin lại thì tạo đề nghị mới."
        confirmLabel="Rút đề nghị"
        variant="default"
        loading={withdraw.isPending}
        closeOnConfirm={false}
        error={error ?? undefined}
        onConfirm={() =>
          withdraw.mutate(
            { id: request.id, version: request.version },
            { onSuccess: close, onError },
          )
        }
      />
    </div>
  );
}
