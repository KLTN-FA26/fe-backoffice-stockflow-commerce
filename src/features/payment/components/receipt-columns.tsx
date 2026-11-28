"use client";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { CustomerName } from "@/components/backoffice/CustomerName";
import { CELL } from "@/components/shared/column-helpers";

import { isAutomaticReceipt } from "../selectors";

import {
  AutomaticReceiptBadge,
  CodeLink,
  DateCell,
  MoneyCell,
  ReceiptStatusDot,
} from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { PaymentReceipt } from "../types";

const C = PAYMENT_LABELS.columns;

/** Cột có thể sắp xếp theo BE (`PaymentReceiptService.SORT`). */
export const RECEIPT_SORTABLE = new Set(["receivedOn", "recordedAt", "amount"]);

/** Thứ tự cột; mã tham chiếu (link chi tiết) khoá (data-table-mode-a §4.2). */
export const RECEIPT_COLUMN_KEYS = [
  "reference",
  "customer",
  "installments",
  "receivedOn",
  "amount",
  "recordedAt",
  "status",
] as const;
export type ReceiptColumn = (typeof RECEIPT_COLUMN_KEYS)[number];
export const RECEIPT_LOCKED_COLUMNS: readonly ReceiptColumn[] = ["reference"];
/**
 * bo-24: "Hợp đồng · Đợt" thay cột đếm số dòng (đã ẩn vì BE danh sách không kèm đợt). BE PR #497 kèm hợp đồng / đơn / đợt
 * trên `lines[]` của danh sách; BE cũ thì trang không có cột này (`receiptLinesNamed`).
 */
export const RECEIPT_DEFAULT_COLUMNS: readonly ReceiptColumn[] = RECEIPT_COLUMN_KEYS;

/** Có dòng nào của trang mang số hợp đồng không — không có (BE trước PR #497) thì bỏ cột "Hợp đồng · Đợt". */
export function receiptLinesNamed(rows: readonly PaymentReceipt[] | undefined): boolean {
  return (rows ?? []).some((row) => row.lines.some((line) => !!line.contractNumber));
}
export const RECEIPT_COLUMN_LABELS: Record<ReceiptColumn, string> = {
  reference: C.reference,
  customer: C.customer,
  installments: PAYMENT_LABELS.receipts.installmentsColumn,
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
      <span className="inline-flex items-center gap-2">
        <CodeLink href={PAYMENT_ROUTES.receipts.detail(row.receiptId)}>{row.reference}</CodeLink>
        {isAutomaticReceipt(row) && <AutomaticReceiptBadge />}
      </span>
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
    key: "installments",
    header: PAYMENT_LABELS.receipts.installmentsColumn,
    cell: (row) => <ReceiptInstallmentsCell receipt={row} />,
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

/** "HD-… · Đợt 2" của một dòng phiếu thu; null khi BE không gửi hợp đồng của dòng. */
function lineLabel(line: PaymentReceipt["lines"][number]): string | null {
  if (!line.contractNumber) return null;
  return line.seq != null ? `${line.contractNumber} · Đợt ${line.seq}` : line.contractNumber;
}

/**
 * Các đợt phiếu thu đã trả: dòng đầu "HD-… · Đợt n" (thêm "+k đợt" khi trả nhiều đợt), dòng dưới số đơn. Rê chuột xem đủ
 * các đợt kèm tên đợt.
 */
function ReceiptInstallmentsCell({ receipt }: { receipt: PaymentReceipt }) {
  const named = receipt.lines.filter((line) => !!line.contractNumber);
  const first = named[0];
  if (!first) return <span className={CELL.empty}>—</span>;
  const title = named
    .map((line) => [lineLabel(line), line.name].filter(Boolean).join(" — "))
    .join("\n");
  const orders = [...new Set(named.map((line) => line.orderNumber).filter(Boolean))];
  return (
    <div className="flex flex-col whitespace-nowrap" title={title}>
      <span className={CELL.ref}>
        {lineLabel(first)}
        {named.length > 1 && (
          <span className={`${CELL.sub} ml-1.5 font-sans`}>
            {PAYMENT_LABELS.receipts.moreInstallments(named.length - 1)}
          </span>
        )}
      </span>
      {orders.length > 0 && <span className={CELL.sub}>{orders.join(", ")}</span>}
    </div>
  );
}
