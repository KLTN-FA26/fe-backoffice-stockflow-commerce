"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format";
import {
  CELL,
  dateCell,
  stackCell,
  statusCell,
  viewColumn,
} from "@/components/shared/column-helpers";

import { COLUMN_LABELS } from "./constants";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Order } from "../../types";

type OrderColumn = ColumnDef<Order> & { key: string };

/** Cột bảng đơn hàng. Sort phía server; không có search trong cột (server không hỗ trợ). */
export function buildOrderColumns(): OrderColumn[] {
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
    // Ô hai dòng: tên người nhận + SĐT
    stackCell<Order>(
      "recipient",
      COLUMN_LABELS.recipient,
      (row) => row.recipientName,
      (row) => row.recipientPhone,
    ),
    dateCell<Order>("placedAt", COLUMN_LABELS.placedAt, (row) => row.placedAt, { sortable: true }),
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
