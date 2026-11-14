"use client";

import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";

import { CodeLink, MoneyCell, RefundStateDot } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { OrderRefund } from "../types";

const L = PAYMENT_LABELS.refunds;

/** Cột bảng đơn có số tiền phải hoàn (docs 15 §5.3: chờ hoàn / hoàn một phần / đã hoàn). */
export const REFUND_COLUMNS: ColumnDef<OrderRefund>[] = [
  {
    key: "order",
    header: PAYMENT_LABELS.columns.order,
    cell: (row) => (
      <CodeLink href={PAYMENT_ROUTES.refunds.ofOrder(row.orderId)}>{row.orderNumber}</CodeLink>
    ),
  },
  {
    key: "status",
    header: PAYMENT_LABELS.columns.status,
    cell: (row) => <RefundStateDot status={row.refundStatus} />,
  },
  {
    key: "refundable",
    header: L.refundable,
    align: "right",
    cell: (row) => <MoneyCell amount={row.refundable} currency={row.currency} />,
  },
  {
    key: "refunded",
    header: L.refunded,
    align: "right",
    cell: (row) => <MoneyCell amount={row.refunded} currency={row.currency} />,
  },
  {
    key: "remaining",
    header: L.remaining,
    align: "right",
    cell: (row) => <MoneyCell amount={row.remaining} currency={row.currency} />,
  },
];
