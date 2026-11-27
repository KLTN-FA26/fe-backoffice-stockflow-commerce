"use client";

import { formatDate } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";
import { FORM_INPUT_CLASS } from "@/components/shared/form-control-classes";
import { Skeleton } from "@/components/shared/Skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

import { useCustomerInstallments } from "../queries";
import { payableInstallments } from "../selectors";

import { MONO } from "./primitives";

/** Các đợt còn phải thu của khách: tick để gán, số tiền mặc định = min(còn phải thu, phần giao dịch còn lại). */
export function InstallmentLines({
  customerId,
  amounts,
  onChange,
  remaining,
}: {
  customerId: string;
  amounts: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  remaining: number;
}) {
  const query = useCustomerInstallments(customerId, true);
  if (query.isPending) return <Skeleton className="h-20" />;
  if (query.isError)
    return (
      <p role="alert" className="text-danger text-[0.8125rem]">
        Không tải được các đợt của khách.{" "}
        <button type="button" className="underline" onClick={() => void query.refetch()}>
          Thử lại
        </button>
      </p>
    );
  const rows = payableInstallments(query.data);
  if (rows.length === 0)
    return (
      <p className="text-ink-tertiary text-[0.8125rem]">Khách không có đợt nào còn phải thu.</p>
    );

  const toggle = (id: string, outstanding: number, on: boolean) => {
    const next = { ...amounts };
    if (on) next[id] = String(Math.max(0, Math.min(outstanding, remaining)));
    else delete next[id];
    onChange(next);
  };

  return (
    <ul className="border-border-default divide-y divide-(--table-line) rounded-(--field-radius) border">
      {rows.map((row) => {
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
              </p>
              <p className="text-ink-tertiary text-xs">
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
  );
}
