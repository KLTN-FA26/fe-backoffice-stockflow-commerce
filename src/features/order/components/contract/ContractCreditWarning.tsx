"use client";

import { formatMoney } from "@/lib/format/money";
import { Notice } from "@/components/shared/Notice";
import { Button } from "@/components/ui/button";

import { creditWarningText } from "../../sales-contract-rules";

import type { SalesContract } from "../../sales-contract-schemas";

/**
 * Cảnh báo tín dụng trên hợp đồng nháp (BE `creditWarning`, 15 BR-11 — cảnh báo, không chặn): GỬI lúc này sẽ phải chờ
 * Kế toán duyệt (BE PR #486). Hai hướng "Sửa lịch thanh toán" (mở editor) / "Gửi Kế toán duyệt" (hộp thoại gửi).
 */
export function ContractCreditWarning({
  contract,
  onEdit,
  onSend,
}: {
  contract: SalesContract;
  onEdit?: () => void;
  onSend?: () => void;
}) {
  const warning = contract.creditWarning;
  if (!warning) return null;
  const money = (amount: number) => formatMoney(amount, contract.totals.currency);
  return (
    <Notice tone="warning">
      <p>{creditWarningText(warning, money)}</p>
      {warning.creditLimit != null && (
        <p className="text-ink-secondary mt-1">Hạn mức: {money(warning.creditLimit)}</p>
      )}
      {(onEdit || onSend) && (
        <div className="mt-2 flex gap-2">
          {onEdit && (
            <Button type="button" size="sm" variant="outline" onClick={onEdit}>
              Sửa lịch thanh toán
            </Button>
          )}
          {onSend && (
            <Button type="button" size="sm" variant="outline" onClick={onSend}>
              Gửi Kế toán duyệt
            </Button>
          )}
        </div>
      )}
    </Notice>
  );
}
