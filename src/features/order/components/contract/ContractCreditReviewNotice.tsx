"use client";

import { useState } from "react";
import { Undo2 } from "lucide-react";

import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Notice } from "@/components/shared/Notice";
import { toast } from "@/components/shared/Toast";
import { Button } from "@/components/ui/button";

import {
  contractErrorMessage,
  useWithdrawContractCreditReview,
} from "../../sales-contract-mutations";
import { creditReviewReasonText } from "../../sales-contract-rules";

import type { SalesContract } from "../../sales-contract-schemas";

/**
 * 15 BR-11 (BE PR #486) trên hợp đồng nháp của Sale:
 * - `creditReview = PENDING` → "đang chờ Kế toán duyệt tín dụng", sửa / gửi đã khoá (`allowedContractActions`),
 *   nút "Rút đề nghị" khi có quyền (`withdraw-review`).
 * - Lượt gần nhất bị từ chối và không còn chờ → hiện lý do để Sale sửa lịch thanh toán rồi gửi lại.
 */
export function ContractCreditReviewNotice({
  contract,
  canWithdraw,
}: {
  contract: SalesContract;
  canWithdraw: boolean;
}) {
  const withdraw = useWithdrawContractCreditReview();
  const [confirming, setConfirming] = useState(false);
  const review = contract.latestCreditReview;
  const money = (amount: number) => formatMoney(amount, contract.totals.currency);

  if (contract.creditReview === "PENDING") {
    return (
      <Notice tone="warning">
        <p className="font-medium">
          Đang chờ Kế toán duyệt tín dụng — hợp đồng chưa được gửi cho khách.
        </p>
        {review && (
          <p className="text-ink-secondary mt-1">
            {creditReviewReasonText(review, money)} Gửi duyệt lúc{" "}
            {formatDateTime(review.submittedAt)}.
          </p>
        )}
        <p className="text-ink-secondary mt-1">
          Kế toán duyệt thì hợp đồng tự gửi cho khách. Muốn sửa hợp đồng phải rút đề nghị trước.
        </p>
        {canWithdraw && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setConfirming(true)}
          >
            <Undo2 className="size-3.5" /> Rút đề nghị
          </Button>
        )}
        <ConfirmDialog
          open={confirming}
          onOpenChange={setConfirming}
          title="Rút đề nghị duyệt tín dụng?"
          description="Hợp đồng về Nháp để sửa. Muốn gửi lại thì bấm Gửi hợp đồng như cũ."
          confirmLabel="Rút đề nghị"
          variant="default"
          loading={withdraw.isPending}
          closeOnConfirm={false}
          onConfirm={() =>
            withdraw.mutate(
              { orderId: contract.orderId, version: contract.version },
              {
                onSuccess: () => setConfirming(false),
                onError: (error) => toast.error(contractErrorMessage(error)),
              },
            )
          }
        />
      </Notice>
    );
  }

  if (contract.status === "DRAFT" && review?.outcome === "REJECTED") {
    return (
      <Notice tone="danger">
        <p className="font-medium">Kế toán đã từ chối duyệt tín dụng.</p>
        {review.note && <p className="mt-1">Lý do: {review.note}</p>}
        <p className="text-ink-secondary mt-1">
          Sửa lịch thanh toán (giảm phần trả sau giao) rồi gửi lại.
        </p>
      </Notice>
    );
  }
  return null;
}
