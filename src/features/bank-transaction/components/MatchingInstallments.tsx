"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

import { BANK_TRANSACTION_LABELS } from "@/constants/bank-transaction";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { DetailPanel } from "@/components/shared/DetailPanel";
import { Skeleton } from "@/components/shared/Skeleton";
import { Button } from "@/components/ui/button";

import { useMatchingInstallments } from "../queries";
import { matchingInstallments } from "../selectors";

import { AssignDialog } from "./AssignDialog";
import { MONO } from "./primitives";

import type { BankTransaction, PayableInstallment } from "../types";

const L = BANK_TRANSACTION_LABELS.matches;

/**
 * "Đợt có thể khớp" (bo-26): các đợt còn phải thu đúng bằng số tiền của giao dịch chờ xử lý, mỗi đợt một nút "Gắn" mở
 * hộp thoại gán đã chọn sẵn đợt đó. BE lọc đúng số tiền (`GET /installments?outstanding=`, PR #497):
 * - giao dịch nhận ra khách → đợt của khách đó (`customerId`);
 * - không nhận ra khách → đợt đã đến hạn còn nợ của mọi khách (`owing=true`).
 * FE vẫn giữ đúng các đợt còn nhận tiền bằng số tiền (`matchingInstallments`) — BE chưa có tham số thì nó bỏ qua và trả
 * mọi đợt; khi đó không nói "còn đợt khác" vì tổng không phải số đợt khớp.
 */
export function MatchingInstallments({ transaction }: { transaction: BankTransaction }) {
  const customerId = transaction.customerId ?? null;
  const state = useMatchingInstallments(transaction.amount, customerId);
  const [picked, setPicked] = useState<PayableInstallment | null>(null);
  const rows = state.data?.items ?? [];
  const matches = matchingInstallments(rows, transaction.amount);
  const money = (amount: number) => formatMoney(amount, transaction.currency);
  const filteredByBe = matches.length === rows.length;
  const truncated =
    state.data && filteredByBe && state.data.totalElements > rows.length
      ? L.moreMatches(rows.length, state.data.totalElements)
      : null;

  return (
    <DetailPanel
      title={L.title}
      count={state.isSuccess ? matches.length : undefined}
      description={
        customerId
          ? L.descriptionOfCustomer(money(transaction.amount))
          : L.description(money(transaction.amount))
      }
    >
      {state.isPending ? (
        <Skeleton className="h-16" />
      ) : state.isError ? (
        <p role="alert" className="text-danger text-[0.8125rem]">
          {L.loadError}{" "}
          <button type="button" className="underline" onClick={() => void state.refetch()}>
            {L.retry}
          </button>
        </p>
      ) : matches.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{customerId ? L.none : L.noneOwing}</p>
      ) : (
        <ul className="divide-y divide-(--table-line)">
          {matches.map((row) => (
            <li
              key={row.installmentId}
              className="flex items-center gap-3 py-2 text-[0.8125rem] first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-ink-primary">
                  <span className={MONO}>{row.contractNumber}</span> ·{" "}
                  {L.installment(row.seq, row.name)}
                </p>
                <p className="text-ink-tertiary text-xs">
                  {[
                    row.customerName ?? row.customerCode,
                    row.orderNumber,
                    row.dueDate ? L.due(formatDate(row.dueDate)) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <span className={`${MONO} text-ink-primary whitespace-nowrap`}>
                {formatMoney(row.outstanding, row.currency)}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-label={L.assignLabel(row.contractNumber, row.seq)}
                onClick={() => setPicked(row)}
              >
                <Link2 className="size-3.5" aria-hidden="true" /> {L.assign}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {truncated && <p className="text-ink-tertiary mt-3 text-xs">{truncated}</p>}
      {picked && (
        <AssignDialog
          transaction={transaction}
          initial={{ customerId: picked.customerId, installmentId: picked.installmentId }}
          onClose={() => setPicked(null)}
        />
      )}
    </DetailPanel>
  );
}
