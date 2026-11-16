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

export const RECEIPT_COLUMNS: ColumnDef<PaymentReceipt>[] = [
  {
    key: "reference",
    header: C.reference,
    cell: (row) => (
      <CodeLink href={PAYMENT_ROUTES.receipts.detail(row.receiptId)}>{row.reference}</CodeLink>
    ),
  },
  { key: "customer", header: C.customer, cell: (row) => <CustomerName id={row.customerId} /> },
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
