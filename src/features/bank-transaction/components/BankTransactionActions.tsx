"use client";

import { useState } from "react";
import { Ban, Link2 } from "lucide-react";

import { BANK_TRANSACTION_LIMITS } from "@/constants/bank-transaction";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";

import { bankTransactionErrorMessage, useIgnoreBankTransaction } from "../mutations";

import { AssignDialog } from "./AssignDialog";

import type { BankTransactionAction } from "../lifecycle";
import type { BankTransaction } from "../types";

/** "Gán vào đợt" (chính) và "Bỏ qua" (lý do bắt buộc ≤ 500) — chỉ khi NEEDS_REVIEW + quyền UPDATE. */
export function BankTransactionActions({
  transaction,
  actions,
}: {
  transaction: BankTransaction;
  actions: readonly BankTransactionAction[];
}) {
  const [open, setOpen] = useState<"assign" | "ignore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ignore = useIgnoreBankTransaction();
  const close = () => {
    setOpen(null);
    setError(null);
  };
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.includes("assign") && (
        <Button size="sm" onClick={() => setOpen("assign")}>
          <Link2 className="size-3.5" /> Gán vào đợt
        </Button>
      )}
      {actions.includes("ignore") && (
        <Button
          size="sm"
          variant="ghost"
          className="text-danger hover:text-danger"
          onClick={() => setOpen("ignore")}
        >
          <Ban className="size-3.5" /> Bỏ qua
        </Button>
      )}
      {open === "assign" && <AssignDialog transaction={transaction} onClose={close} />}
      <ConfirmDialog
        open={open === "ignore"}
        onOpenChange={(next) => !next && close()}
        title="Bỏ qua giao dịch này?"
        description="Không lập phiếu thu. Giao dịch rời hàng chờ, vẫn tra được ở tab Tất cả."
        confirmLabel="Bỏ qua"
        requireReason
        reasonLabel="Lý do bỏ qua"
        reasonMaxLength={BANK_TRANSACTION_LIMITS.noteMax}
        loading={ignore.isPending}
        closeOnConfirm={false}
        error={error ?? undefined}
        onConfirm={(reason) =>
          ignore.mutate(
            { id: transaction.id, reason: (reason ?? "").trim() },
            { onSuccess: close, onError: (e) => setError(bankTransactionErrorMessage(e)) },
          )
        }
      />
    </div>
  );
}
