"use client";

import { RotateCw } from "lucide-react";

import { ORDER_CONTRACT_LABELS } from "@/constants/labels-order-contract";
import { formatMoney } from "@/lib/format/money";
import { Button } from "@/components/ui/button";

import { useCustomerCreditPosition } from "../credit-hold/useCustomerCreditPosition";

const L = ORDER_CONTRACT_LABELS.credit;

/**
 * Công nợ của khách ngay cạnh lịch thanh toán đang sửa (bo-20): hạn mức, dư nợ hiện tại, phần hợp đồng này trả sau giao,
 * phần còn lại — Sale thấy vượt hạn mức TRƯỚC khi bấm gửi. Cùng phép kiểm của BE khi gửi
 * (`SalesContractService.creditCheck`, 15 BR-10, BR-11): chỉ kiểm khi lịch có đợt trả sau giao; khoản quá hạn thì chờ
 * Kế toán dù còn hạn mức; không có hạn mức = hạn mức 0. Số liệu từ `GET /orders/credit-position/{customerId}`
 * (`customer-credit-profiles:READ`, Sale có); thiếu quyền thì không hiện gì — BE vẫn kiểm khi gửi.
 */
export function ContractCreditPosition({
  customerId,
  deferred,
  currency,
}: {
  customerId: string | null;
  /** Tổng các đợt trả sau giao của lịch đang sửa (`planDeferredAmount`). */
  deferred: number;
  /** Tiền tệ của hợp đồng. */
  currency: string;
}) {
  const state = useCustomerCreditPosition(customerId);
  if (!state.available) return null;
  const frame =
    "border-border-default bg-bg-subtle rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]";
  if (state.isError)
    return (
      <div role="alert" className={`${frame} flex items-center justify-between gap-2`}>
        <span className="text-ink-secondary">{L.error}</span>
        <Button type="button" variant="outline" size="sm" onClick={state.refetch}>
          <RotateCw className="size-3.5" /> {L.retry}
        </Button>
      </div>
    );
  if (state.isPending || !state.data)
    return (
      <p role="status" className={`${frame} text-ink-tertiary`}>
        {L.loading}
      </p>
    );
  const p = state.data;
  const money = (amount: number) => formatMoney(amount, p.currency);
  // Hai tiền tệ khác nhau (không có ở dữ liệu thật — VND cả hai) thì không cộng trừ, chỉ hiện số của từng bên.
  const sameCurrency = p.currency === currency;
  const limit = p.creditLimit ?? 0;
  const remaining = sameCurrency ? limit - p.exposure - deferred : null;
  const checked = deferred > 0;
  const over = checked && remaining !== null && remaining < 0;
  const overdue = checked && p.hasOverdue;
  return (
    <section aria-label={L.title} className={`${frame} space-y-1.5`}>
      <h3 className="text-ink-secondary text-xs font-medium">{L.title}</h3>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-ink-tertiary text-xs">{L.limit}</dt>
          <dd className="font-mono tabular-nums">
            {p.creditLimit === null ? L.noCredit : money(p.creditLimit)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-tertiary text-xs">{L.exposure}</dt>
          <dd className="font-mono tabular-nums">{money(p.exposure)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-tertiary text-xs">{L.deferred}</dt>
          <dd className="font-mono tabular-nums">{formatMoney(deferred, currency)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-ink-tertiary text-xs">{L.remaining}</dt>
          <dd className={`font-mono tabular-nums ${over ? "text-danger font-medium" : ""}`}>
            {remaining === null ? "—" : money(remaining)}
          </dd>
        </div>
      </dl>
      {over && remaining !== null && (
        <p className="text-danger text-xs" aria-live="polite">
          {L.over(money(-remaining))}
        </p>
      )}
      {overdue && (
        <p className="text-danger text-xs" aria-live="polite">
          {L.overdue(money(p.overdueAmount))}
        </p>
      )}
    </section>
  );
}
