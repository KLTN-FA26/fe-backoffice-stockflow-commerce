"use client";

import { useState } from "react";

import { BANK_TRANSACTION_LABELS } from "@/constants/bank-transaction";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useInstallmentSearch } from "../queries";
import { payableInstallments } from "../selectors";

import { AmountMatchTag, MONO } from "./primitives";

import type { PayableInstallment } from "../types";

const L = BANK_TRANSACTION_LABELS.assign;
const DEBOUNCE_MS = 300;

/**
 * Tìm đợt khi chưa chọn khách (bo-27): gõ số hợp đồng / số đơn (hoặc tên / MST khách) → `GET /installments?search=` trên
 * mọi khách (BE PR #497). "Chọn" một đợt thì hộp thoại lấy khách của đợt đó và tick sẵn đợt — một phiếu thu chỉ của một
 * khách. Chỉ hiện đợt còn nhận tiền; đợt còn phải thu đúng bằng số tiền giao dịch lên đầu.
 */
export function InstallmentSearch({
  transactionAmount,
  onPick,
}: {
  transactionAmount: number;
  onPick: (row: PayableInstallment) => void;
}) {
  const [text, setText] = useState("");
  const term = useDebouncedValue(text.trim(), DEBOUNCE_MS);
  const found = useInstallmentSearch(term, term.length > 0);
  const matches = (row: PayableInstallment) => row.outstanding === transactionAmount;
  const rows = payableInstallments(found.data ?? []);
  const ordered = [...rows.filter(matches), ...rows.filter((row) => !matches(row))];

  return (
    <div className="space-y-2">
      <Input
        type="search"
        aria-label={L.findLabel}
        placeholder={L.findPlaceholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className={FORM_INPUT_CLASS}
      />
      {!term ? (
        <p className="text-ink-tertiary text-xs">{L.findHint}</p>
      ) : found.isPending ? (
        <Skeleton className="h-16" />
      ) : found.isError ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {L.findError}{" "}
          <button type="button" className="underline" onClick={() => void found.refetch()}>
            Thử lại
          </button>
        </p>
      ) : ordered.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.findEmpty}</p>
      ) : (
        <ul className="border-border-default max-h-64 divide-y divide-(--table-line) overflow-y-auto rounded-(--field-radius) border">
          {ordered.map((row) => (
            <li
              key={row.installmentId}
              className="flex items-center gap-3 px-3 py-2 text-[0.8125rem]"
            >
              <div className="min-w-0 flex-1">
                <p className={`${MONO} text-ink-primary`}>
                  {row.contractNumber} · Đợt {row.seq}
                  {matches(row) && <AmountMatchTag />}
                </p>
                <p className="text-ink-tertiary text-xs">
                  {[
                    row.customerName ?? row.customerCode,
                    row.orderNumber,
                    `còn ${formatMoney(row.outstanding, row.currency)}`,
                    row.dueDate ? `hạn ${formatDate(row.dueDate)}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={L.pickLabel(row.contractNumber, row.seq)}
                onClick={() => onPick(row)}
              >
                {L.pick}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
