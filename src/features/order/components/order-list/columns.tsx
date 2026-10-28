"use client";

import Link from "next/link";

import { ADMIN_ROUTES, ORDER_PAYMENT_STATUS_DISPLAY, ORDER_PAYMENT_TERM_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import {
  CELL,
  dateCell,
  stackCell,
  statusCell,
  viewColumn,
} from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";

import { COLUMN_LABELS } from "./constants";
import { CustomerCell } from "./CustomerCell";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Order } from "../../types";

type OrderColumn = ColumnDef<Order> & { key: string };

/**
 * Cột bảng đơn hàng. Sort phía server; không có search trong cột (server không hỗ trợ).
 * `onFilterCustomer`: lọc nhanh theo khách của dòng (BE chỉ trả `customerId`, chưa có tên khách).
 */
export function buildOrderColumns(onFilterCustomer: (customerId: string) => void): OrderColumn[] {
  return [
    {
      key: "orderNumber",
      header: COLUMN_LABELS.orderNumber,
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: COLUMN_LABELS.customer,
      cell: (row) => <CustomerCell customerId={row.customerId} onFilter={onFilterCustomer} />,
    },
    // Ô hai dòng: tên người nhận + SĐT
    stackCell<Order>(
      "recipient",
      COLUMN_LABELS.recipient,
      (row) => row.recipientName,
      (row) => row.recipientPhone,
    ),
    dateCell<Order>("placedAt", COLUMN_LABELS.placedAt, (row) => row.placedAt, { sortable: true }),
    {
      key: "paymentTerm",
      header: COLUMN_LABELS.paymentTerm,
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem]">
          {row.paymentTerm ? ORDER_PAYMENT_TERM_LABELS[row.paymentTerm] : "—"}
        </span>
      ),
    },
    {
      key: "paymentStatus",
      header: COLUMN_LABELS.paymentStatus,
      cell: (row) =>
        row.paymentStatus ? (
          <StatusDot domain="payment" status={ORDER_PAYMENT_STATUS_DISPLAY[row.paymentStatus]} />
        ) : (
          <span className="text-ink-tertiary text-xs">—</span>
        ),
    },
    // Không dùng moneyCell: tiền tệ lấy từ `currency` của từng đơn (api-conventions §10).
    {
      key: "totalAmount",
      header: COLUMN_LABELS.totalAmount,
      align: "right",
      sortable: true,
      cell: (row) => (
        <span className={CELL.number}>{formatMoney(row.totalAmount, row.currency)}</span>
      ),
    },
    {
      ...statusCell<Order>("status", COLUMN_LABELS.status, (row) => row.status, "order", {
        sortable: true,
        withIcon: true,
      }),
      key: "status",
    },
    viewColumn<Order>((row) => ({
      label: `Xem chi tiết đơn ${row.orderNumber}`,
      href: ADMIN_ROUTES.orders.detail(row.orderId),
    })),
  ];
}
