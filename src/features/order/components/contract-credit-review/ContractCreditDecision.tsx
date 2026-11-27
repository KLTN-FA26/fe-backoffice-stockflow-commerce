"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

import { ApiError } from "@/lib/api/error";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";

import { CONTRACT_CREDIT_NOTE_MAX } from "../../contract-credit-review-schemas";
import {
  contractErrorMessage,
  useApproveContractCredit,
  useRejectContractCredit,
} from "../../sales-contract-mutations";
import { CreditPositionPanel } from "../credit-hold/CreditPositionPanel";
import { useCustomerCreditPosition } from "../credit-hold/useCustomerCreditPosition";

import type { ContractCreditReview } from "../../contract-credit-review-schemas";

/**
 * Lỗi của lúc gửi hợp đồng (BE vẫn kiểm khi duyệt): lượt duyệt VẪN CHỜ — Kế toán từ chối để Sale sửa (handoff B §Lỗi).
 */
const STILL_PENDING_CODES = new Set([
  "DELIVERY_SCHEDULE_INVALID",
  "CUSTOMER_NOT_ACTIVE",
  "PAYMENT_SCHEDULE_NEEDS_CREDIT",
]);

function DecisionError({ error }: { error: unknown }) {
  const stillPending = error instanceof ApiError && STILL_PENDING_CODES.has(error.code);
  return (
    <div className="space-y-1">
      <p>{contractErrorMessage(error)}</p>
      {stillPending && (
        <p>Hợp đồng chưa gửi được nên vẫn chờ duyệt — hãy Từ chối kèm lý do để Sale sửa lại.</p>
      )}
    </div>
  );
}

/** Công nợ HIỆN TẠI của khách — chỉ gọi khi hộp thoại mở (component này chỉ mount trong dialog). */
function CurrentPosition({ customerId }: { customerId: string }) {
  return <CreditPositionPanel state={useCustomerCreditPosition(customerId)} />;
}

type Decision = "approve" | "reject" | null;

/**
 * Ô "Thao tác" của hàng chờ duyệt tín dụng hợp đồng (15 BR-11, BE PR #486): "Duyệt" (hợp đồng gửi cho khách ngay) /
 * "Từ chối" (về Nháp cho Sale). Ghi chú bắt buộc 1–500 ký tự; gửi `contractVersion` của dòng (sai → OPTIMISTIC_LOCK,
 * tải lại). Người đã gửi duyệt tự quyết → 403 CONTRACT_CREDIT_REVIEW_SELF, hiện trong hộp thoại.
 * `canDecide` = `sales-order-credit-holds:APPROVE` — UI-only, Backend phải re-check.
 */
export function ContractCreditDecision({
  row,
  canDecide,
}: {
  row: ContractCreditReview;
  canDecide: boolean;
}) {
  const approve = useApproveContractCredit();
  const reject = useRejectContractCredit();
  const [open, setOpen] = useState<Decision>(null);
  const [error, setError] = useState<unknown>(null);
  const close = () => {
    setOpen(null);
    setError(null);
  };
  if (!canDecide) return <span className="text-ink-tertiary text-xs">—</span>;

  const submit = (decision: "approve" | "reject", note?: string) => {
    const mutation = decision === "approve" ? approve : reject;
    setError(null);
    mutation.mutate(
      { orderId: row.orderId, version: row.contractVersion, note: (note ?? "").trim() },
      { onSuccess: close, onError: setError },
    );
  };
  const dialog = (decision: "approve" | "reject") => (
    <ConfirmDialog
      key={decision}
      open={open === decision}
      onOpenChange={(next) => !next && close()}
      title={
        decision === "approve"
          ? `Duyệt tín dụng hợp đồng ${row.contractNumber}?`
          : `Từ chối hợp đồng ${row.contractNumber}?`
      }
      description={
        decision === "approve"
          ? "Hợp đồng được gửi cho khách ngay, người gửi là Sale đã gửi duyệt. Khi khách ký sẽ không bị treo tín dụng lại, trừ khi tình hình của khách xấu đi."
          : "Hợp đồng về Nháp để Sale sửa lịch thanh toán rồi gửi lại. Sale thấy lý do bạn ghi."
      }
      confirmLabel={decision === "approve" ? "Duyệt và gửi" : "Từ chối"}
      variant={decision === "approve" ? "default" : "danger"}
      requireReason
      reasonLabel={decision === "approve" ? "Ghi chú duyệt" : "Lý do từ chối"}
      reasonMaxLength={CONTRACT_CREDIT_NOTE_MAX}
      loading={(decision === "approve" ? approve : reject).isPending}
      closeOnConfirm={false}
      error={error ? <DecisionError error={error} /> : undefined}
      onConfirm={(note) => submit(decision, note)}
    >
      {open === decision && <CurrentPosition customerId={row.customerId} />}
    </ConfirmDialog>
  );

  return (
    <RowActionsMenu
      label={`Thao tác — ${row.contractNumber}`}
      actions={[
        {
          label: "Duyệt",
          icon: CheckCircle2,
          disabled: approve.isPending,
          onSelect: () => setOpen("approve"),
        },
        {
          label: "Từ chối",
          icon: XCircle,
          danger: true,
          disabled: reject.isPending,
          onSelect: () => setOpen("reject"),
        },
      ]}
    >
      {dialog("approve")}
      {dialog("reject")}
    </RowActionsMenu>
  );
}
