"use client";

import Link from "next/link";
import { Eye, Filter } from "lucide-react";

import { ADMIN_ROUTES, ORDER_PAYMENT_STATUS_DISPLAY, ORDER_PAYMENT_TERM_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { statusCell } from "@/components/shared/column-helpers";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { COLUMN_LABELS } from "./constants";

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
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: COLUMN_LABELS.customer,
      cell: (row) =>
        row.customerId ? (
          <span className="flex items-center gap-1">
            <span
              className="text-ink-secondary max-w-28 truncate font-[family-name:var(--font-mono)] text-xs"
              title={row.customerId}
            >
              {row.customerId}
            </span>
            <Button
              variant="ghost"
              size="icon-xs"
              className="text-ink-tertiary hover:text-ink-primary"
              aria-label={`Lọc đơn của khách ${row.customerId}`}
              onClick={(event) => {
                event.stopPropagation();
                onFilterCustomer(row.customerId ?? "");
              }}
            >
              <Filter className="size-3" />
            </Button>
          </span>
        ) : (
          <span className="text-ink-tertiary text-xs">—</span>
        ),
    },
    {
      key: "recipient",
      header: COLUMN_LABELS.recipient,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-ink-primary text-[0.8125rem]">{row.recipientName || "—"}</span>
          {row.recipientPhone && (
            <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
              {row.recipientPhone}
            </span>
          )}
        </div>
      ),
    },
    // Không dùng dateCell: nó dùng toLocaleDateString không timezone ("12/6/2026"); formatDate
    // có Asia/Ho_Chi_Minh và cùng định dạng với trang chi tiết (api-conventions §10).
    {
      key: "placedAt",
      header: COLUMN_LABELS.placedAt,
      sortable: true,
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
          {formatDate(row.placedAt)}
        </span>
      ),
    },
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
        <span className="text-ink-primary font-[family-name:var(--font-mono)] font-medium tabular-nums">
          {formatMoney(row.totalAmount, row.currency)}
        </span>
      ),
    },
    {
      ...statusCell<Order>("status", COLUMN_LABELS.status, (row) => row.status, "order", {
        sortable: true,
        withIcon: true,
      }),
      key: "status",
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <Button
          variant="outline"
          size="icon-sm"
          className="border-border-default bg-bg-surface text-ink-tertiary hover:bg-bg-muted hover:text-ink-primary rounded-[var(--r-sm)]"
          asChild
        >
          <Link
            href={ADMIN_ROUTES.orders.detail(row.orderId)}
            aria-label={`Xem chi tiết đơn ${row.orderNumber}`}
            onClick={(event) => event.stopPropagation()}
          >
            <Eye className="size-3.5" />
          </Link>
        </Button>
      ),
    },
  ];
}
