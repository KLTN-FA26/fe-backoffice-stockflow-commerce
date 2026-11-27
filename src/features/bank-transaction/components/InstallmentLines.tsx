"use client";

import { useState } from "react";

import { BANK_TRANSACTION_LABELS } from "@/constants/bank-transaction";
import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Skeleton } from "@/components/shared/Skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { textIncludes } from "@/lib/text-match";

import { AmountMatchTag, MONO } from "./primitives";

import type { PayableInstallment } from "../types";

const L = BANK_TRANSACTION_LABELS.assign;
/** Từ chừng này đợt trở lên mới có ô tìm theo số hợp đồng / số đơn — ít hơn thì nhìn là thấy. */
const SEARCH_MIN_ROWS = 6;

/**
 * Các đợt còn phải thu của khách: tick để gán, số tiền mặc định = min(còn phải thu, phần giao dịch còn lại). Đợt còn phải
 * thu đúng bằng số tiền giao dịch lên đầu kèm nhãn "Khớp số tiền". Khách nhiều đợt → ô tìm theo số hợp đồng / số đơn,
 * lọc trên các đợt đã tải (BE `GET /installments` chưa tìm theo số hợp đồng / số đơn); đợt đã tick luôn hiện.
 */
export function InstallmentLines({
  state,
  rows,
  amounts,
  onChange,
  remaining,
  transactionAmount,
}: {
  /** Trạng thái tải các đợt của khách (`useCustomerInstallments`, do hộp thoại giữ). */
  state: { isPending: boolean; isError: boolean; refetch: () => unknown };
  /** Đợt còn nhận tiền (`payableInstallments`). */
  rows: readonly PayableInstallment[];
  amounts: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  remaining: number;
  /** Số tiền của giao dịch — đợt còn phải thu đúng bằng số này được gợi ý trước. */
  transactionAmount: number;
}) {
  const [search, setSearch] = useState("");
  if (state.isPending) return <Skeleton className="h-20" />;
  if (state.isError)
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        Không tải được các đợt của khách.{" "}
        <button type="button" className="underline" onClick={() => void state.refetch()}>
          Thử lại
        </button>
      </p>
    );
  if (rows.length === 0)
    return (
      <p className="text-ink-tertiary text-[0.8125rem]">Khách không có đợt nào còn phải thu.</p>
    );

  const matches = (row: PayableInstallment) => row.outstanding === transactionAmount;
  const ordered = [...rows.filter(matches), ...rows.filter((row) => !matches(row))];
  const visible = ordered.filter(
    (row) =>
      row.installmentId in amounts ||
      textIncludes(row.contractNumber, search) ||
      textIncludes(row.orderNumber, search),
  );

  const toggle = (id: string, outstanding: number, on: boolean) => {
    const next = { ...amounts };
    if (on) next[id] = String(Math.max(0, Math.min(outstanding, remaining)));
    else delete next[id];
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.length >= SEARCH_MIN_ROWS && (
        <Input
          type="search"
          aria-label={L.searchLabel}
          placeholder={L.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={FORM_INPUT_CLASS}
        />
      )}
      {visible.length === 0 ? (
        <p className="text-ink-tertiary text-[0.8125rem]">{L.searchEmpty}</p>
      ) : (
        <ul className="border-border-default divide-y divide-(--table-line) rounded-(--field-radius) border">
          {visible.map((row) => {
            const checked = row.installmentId in amounts;
            const value = amounts[row.installmentId] ?? "";
            return (
              <li
                key={row.installmentId}
                className="flex items-center gap-3 px-3 py-2 text-[0.8125rem]"
              >
                <Checkbox
                  checked={checked}
                  aria-label={`Gán ${row.contractNumber} đợt ${row.seq}`}
                  onCheckedChange={(on) => toggle(row.installmentId, row.outstanding, on === true)}
                />
                <div className="min-w-0 flex-1">
                  <p className={`${MONO} text-ink-primary`}>
                    {row.contractNumber} · Đợt {row.seq}
                    {matches(row) && <AmountMatchTag />}
                  </p>
                  <p className="text-ink-tertiary text-xs">
                    <span className="font-[family-name:var(--font-mono)]">{row.orderNumber}</span> ·{" "}
                    {row.name} · còn {formatMoney(row.outstanding, row.currency)}
                    {row.dueDate && ` · hạn ${formatDate(row.dueDate)}`}
                  </p>
                </div>
                {checked && (
                  <Input
                    aria-label={`Số tiền gán ${row.contractNumber} đợt ${row.seq}`}
                    inputMode="numeric"
                    value={value}
                    placeholder={String(row.outstanding)}
                    onChange={(e) => onChange({ ...amounts, [row.installmentId]: e.target.value })}
                    className={`${FORM_INPUT_CLASS} ${MONO} w-36 text-right`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
