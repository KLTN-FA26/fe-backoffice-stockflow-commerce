"use client";

import { useState } from "react";
import Link from "next/link";
import { FileDown, Info, ListChecks } from "lucide-react";

import { RECEIVABLES_LABELS as L } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { RowActionsMenu } from "@/components/shared/RowActionsMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { creditUsedPercent } from "../selectors";

import { MONO } from "./copy";
import { DebtReconciliationDialog, useCanReconcileDebt } from "./DebtReconciliationAction";
import { DateCell, MoneyCell } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { Receivable } from "../types";

export const RECEIVABLE_COLUMNS = [
  "customer",
  "owed",
  "overdue",
  "signingOverdue",
  "d0to30",
  "d31to60",
  "over60",
  "creditLimit",
  "oldestDueOn",
  "installmentCount",
  "actions",
] as const;
export type ReceivableColumn = (typeof RECEIVABLE_COLUMNS)[number];
/** "Hạn cũ nhất" và "Số đợt" ẩn mặc định (bật lại qua Ẩn hiện cột) — bảng vừa 1440px, cột "> 60 ngày" không bị cắt. */
export const RECEIVABLE_DEFAULT_COLUMNS: readonly ReceivableColumn[] = RECEIVABLE_COLUMNS.filter(
  (column) => column !== "oldestDueOn" && column !== "installmentCount",
);
export const RECEIVABLE_LOCKED_COLUMNS: readonly ReceivableColumn[] = ["customer", "actions"];
export const RECEIVABLE_COLUMN_LABELS: Record<ReceivableColumn, string> = {
  customer: L.customer,
  owed: L.owed,
  overdue: L.overdue,
  signingOverdue: L.signingOverdue,
  d0to30: L.d0to30,
  d31to60: L.d31to60,
  over60: L.over60,
  creditLimit: L.creditLimit,
  oldestDueOn: L.oldestDue,
  installmentCount: L.installmentCount,
  actions: L.actions,
};

/** Tiền một ô; 0 hiện mờ để mắt dừng ở ô có nợ. */
export function Amount({ value, currency = "VND" }: { value: number; currency?: string }) {
  return value > 0 ? (
    <MoneyCell amount={value} currency={currency} />
  ) : (
    <span className={`text-ink-tertiary ${MONO}`}>0</span>
  );
}

/** Dấu "i" cạnh tiêu đề cột, rê / focus để đọc chú thích (bo-23: "Quá hạn" và "Quá hạn đợt ký" khác nhau). */
function HeaderHint({ column, text }: { column: string; text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={L.hintLabel(column)}
            className="text-ink-tertiary hover:text-ink-primary rounded-(--r-sm) p-0.5"
          >
            <Info className="size-3" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-72 text-left whitespace-normal">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Hạn mức + "Đã dùng x%" (dư nợ tính hạn mức / hạn mức, BE `exposure`); vượt 100% thì số % đỏ. */
function CreditLimitCell({ row }: { row: Receivable }) {
  if (row.creditLimit == null) return <span className="text-ink-tertiary">{L.noCreditLimit}</span>;
  const percent = creditUsedPercent(row);
  return (
    <span className="flex flex-col items-end">
      <MoneyCell amount={row.creditLimit} currency={row.currency} />
      {percent !== null && (
        <span
          title={L.creditUsedTitle}
          className={`text-xs tabular-nums ${percent > 100 ? "text-danger font-medium" : "text-ink-tertiary"}`}
        >
          {L.creditUsed(percent)}
        </span>
      )}
    </span>
  );
}

/** "⋯" của dòng khách: xem các đợt còn nợ; đối chiếu công nợ (chọn kỳ, tải biên bản) khi có quyền. */
function ReceivableRowActions({ row }: { row: Receivable }) {
  const canReconcile = useCanReconcileDebt();
  const [open, setOpen] = useState(false);
  const name = row.customerName ?? row.customerCode ?? L.customer;
  const actions: RowAction[] = [
    {
      label: L.viewOwing,
      icon: ListChecks,
      href: PAYMENT_ROUTES.installments.owingByCustomer(row.customerId),
    },
  ];
  if (canReconcile)
    actions.push({ label: L.reconciliation, icon: FileDown, onSelect: () => setOpen(true) });
  return (
    <RowActionsMenu label={L.rowActions(name)} actions={actions}>
      {canReconcile && (
        <DebtReconciliationDialog
          customerId={row.customerId}
          customerName={name}
          open={open}
          onClose={() => setOpen(false)}
        />
      )}
    </RowActionsMenu>
  );
}

/** Cột công nợ phải thu theo khách (BO-UX-37, bo-23). */
export const RECEIVABLE_COLUMN_DEFS: ColumnDef<Receivable>[] = [
  {
    key: "customer",
    header: L.customer,
    className: "min-w-52 whitespace-normal",
    cell: (row) => (
      <Link
        href={PAYMENT_ROUTES.installments.owingByCustomer(row.customerId)}
        className="flex flex-col hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="text-accent-text font-medium">{row.customerName ?? L.customer}</span>
        {(row.customerCode || row.taxCode) && (
          <span className="text-ink-tertiary text-xs">
            {[row.customerCode, row.taxCode && `${L.taxCode} ${row.taxCode}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </Link>
    ),
  },
  {
    key: "owed",
    header: L.owed,
    align: "right",
    cell: (row) => <Amount value={row.owed} currency={row.currency} />,
  },
  {
    key: "overdue",
    header: L.overdue,
    align: "right",
    headerFilter: <HeaderHint column={L.overdue} text={L.overdueHint} />,
    cell: (row) => <Amount value={row.overdue} currency={row.currency} />,
  },
  {
    // Đợt thu khi ký đã quá hạn: không nằm trong "Còn phải thu" / "Quá hạn" (docs 15 §4.3) nhưng kiểm tra tín dụng của
    // hợp đồng mới tính là quá hạn — hiện riêng để khách đó không trông như sạch nợ.
    key: "signingOverdue",
    header: L.signingOverdue,
    align: "right",
    headerFilter: <HeaderHint column={L.signingOverdue} text={L.signingOverdueHint} />,
    cell: (row) => <Amount value={row.signingOverdue} currency={row.currency} />,
  },
  {
    key: "d0to30",
    header: L.d0to30,
    align: "right",
    cell: (row) => <Amount value={row.aging?.d0to30 ?? 0} currency={row.currency} />,
  },
  {
    key: "d31to60",
    header: L.d31to60,
    align: "right",
    cell: (row) => <Amount value={row.aging?.d31to60 ?? 0} currency={row.currency} />,
  },
  {
    key: "over60",
    header: L.over60,
    align: "right",
    cell: (row) => <Amount value={row.aging?.over60 ?? 0} currency={row.currency} />,
  },
  {
    key: "creditLimit",
    header: L.creditLimit,
    align: "right",
    cell: (row) => <CreditLimitCell row={row} />,
  },
  {
    key: "oldestDueOn",
    header: L.oldestDue,
    align: "right",
    cell: (row) => <DateCell iso={row.oldestDueOn} />,
  },
  {
    key: "installmentCount",
    header: L.installmentCount,
    align: "right",
    cell: (row) => <span className={MONO}>{row.installmentCount ?? "—"}</span>,
  },
  { key: "actions", header: L.actions, cell: (row) => <ReceivableRowActions row={row} /> },
];
