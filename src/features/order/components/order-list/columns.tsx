"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format";
import { dateCell, statusCell } from "@/components/shared/column-helpers";
import { Button } from "@/components/ui/button";

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
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
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
    {
      ...dateCell<Order>("placedAt", COLUMN_LABELS.placedAt, (row) => row.placedAt, {
        sortable: true,
      }),
      key: "placedAt",
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
