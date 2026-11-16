"use client";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { CustomerName } from "@/components/backoffice/CustomerName";

import { blocksHandover, deliveryBatchLabel, displayStatus, milestoneLabel } from "../selectors";

import { MONO } from "./copy";
import { CodeLink, DateCell, InstallmentStatusDot, MoneyCell } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Installment } from "../types";

const C = PAYMENT_LABELS.columns;
const L = PAYMENT_LABELS.installments;

/** Cột có thể sắp xếp theo BE (`InstallmentService.SORT`). */
export const INSTALLMENT_SORTABLE = new Set(["dueDate", "amount", "status"]);

/**
 * Cột bảng đợt thanh toán (docs 15 §5.1): hợp đồng + đợt, đơn, mốc, đợt giao gắn kèm, số tiền / đã thu /
 * còn phải thu, hạn trả và trạng thái. `actions` là ô thao tác của từng dòng (lập phiếu thu).
 */
export function buildInstallmentColumns(
  actions?: (row: Installment) => React.ReactNode,
): ColumnDef<Installment>[] {
  const columns: ColumnDef<Installment>[] = [
    {
      key: "contract",
      header: C.contract,
      cell: (row) => (
        <CodeLink href={PAYMENT_ROUTES.installments.detail(row.installmentId)}>
          {row.contractNumber}
        </CodeLink>
      ),
    },
    {
      key: "installment",
      header: C.installment,
      cell: (row) => (
        <span className="text-ink-primary">
          <span className={MONO}>{row.seq}</span> — {row.name}
        </span>
      ),
    },
    {
      key: "order",
      header: C.order,
      cell: (row) => (
        <CodeLink href={ADMIN_ROUTES.orders.detail(row.orderId)}>{row.orderNumber}</CodeLink>
      ),
    },
    { key: "customer", header: C.customer, cell: (row) => <CustomerName id={row.customerId} /> },
    { key: "milestone", header: C.milestone, cell: (row) => milestoneLabel(row.milestone) },
    {
      key: "batch",
      header: C.deliveryBatch,
      cell: (row) => (
        <span className="text-ink-secondary">
          {deliveryBatchLabel(row)}
          {blocksHandover(row) && (
            <span className="text-warning ml-2 text-xs">{L.handoverBlocked}</span>
          )}
        </span>
      ),
    },
    {
      key: "amount",
      header: C.amount,
      sortable: true,
      align: "right",
      cell: (row) => <MoneyCell amount={row.amount} currency={row.currency} />,
    },
    {
      key: "paid",
      header: C.paid,
      align: "right",
      cell: (row) => <MoneyCell amount={row.paidAmount} currency={row.currency} />,
    },
    {
      key: "outstanding",
      header: C.outstanding,
      align: "right",
      cell: (row) => <MoneyCell amount={row.outstanding} currency={row.currency} />,
    },
    {
      key: "dueDate",
      header: C.dueDate,
      sortable: true,
      align: "right",
      cell: (row) =>
        row.dueDate ? (
          <DateCell iso={row.dueDate} />
        ) : (
          <span className="text-ink-tertiary">{L.noDueDate}</span>
        ),
    },
    {
      key: "status",
      header: C.status,
      sortable: true,
      cell: (row) => <InstallmentStatusDot status={displayStatus(row)} />,
    },
  ];
  if (actions) columns.push({ key: "actions", header: C.actions, align: "right", cell: actions });
  return columns;
}
