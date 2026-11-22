"use client";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { CustomerName } from "@/components/backoffice/CustomerName";

import { CodeLink, DateCell, MoneyCell, ReceiptStatusDot } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PaymentReceipt } from "../types";

const C = PAYMENT_LABELS.columns;

/** Cột có thể sắp xếp theo BE (`PaymentReceiptService.SORT`). */
export const RECEIPT_SORTABLE = new Set(["receivedOn", "recordedAt", "amount"]);

/** Thứ tự cột; mã tham chiếu (link chi tiết) khoá (data-table-mode-a §4.2). */
export const RECEIPT_COLUMN_KEYS = [
  "reference",
  "customer",
  "lines",
  "receivedOn",
  "amount",
  "recordedAt",
  "status",
] as const;
export type ReceiptColumn = (typeof RECEIPT_COLUMN_KEYS)[number];
export const RECEIPT_LOCKED_COLUMNS: readonly ReceiptColumn[] = ["reference"];
export const RECEIPT_COLUMN_LABELS: Record<ReceiptColumn, string> = {
  reference: C.reference,
  customer: C.customer,
  lines: PAYMENT_LABELS.receipts.lines,
  receivedOn: C.receivedOn,
  amount: C.amount,
  recordedAt: C.recordedAt,
  status: C.status,
};

export const RECEIPT_COLUMNS: ColumnDef<PaymentReceipt>[] = [
  {
    key: "reference",
    header: C.reference,
    cell: (row) => (
      <CodeLink href={PAYMENT_ROUTES.receipts.detail(row.receiptId)}>{row.reference}</CodeLink>
    ),
  },
  {
    key: "customer",
    header: C.customer,
    cell: (row) => (
      <CustomerName id={row.customerId} name={row.customerName} code={row.customerCode} />
    ),
  },
  {
    key: "lines",
    header: PAYMENT_LABELS.receipts.lines,
    align: "right",
    cell: (row) => <span className="tabular-nums">{row.lines.length}</span>,
  },
  {
    key: "receivedOn",
    header: C.receivedOn,
    sortable: true,
    align: "right",
    cell: (row) => <DateCell iso={row.receivedOn} />,
  },
  {
    key: "amount",
    header: C.amount,
    sortable: true,
    align: "right",
    cell: (row) => <MoneyCell amount={row.amount} currency={row.currency} />,
  },
  {
    key: "recordedAt",
    header: C.recordedAt,
    sortable: true,
    align: "right",
    cell: (row) => <DateCell iso={row.recordedAt} />,
  },
  { key: "status", header: C.status, cell: (row) => <ReceiptStatusDot status={row.status} /> },
];
