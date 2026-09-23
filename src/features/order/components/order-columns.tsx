import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, ORDER_STATUSES } from "@/constants";
import { STATUS_LABEL_VI } from "@/lib/status-map";
import { dateCell, moneyCell, statusCell } from "@/components/shared/column-helpers";
import { ColumnFilterButton } from "@/components/shared/ListToolbar";
import { Button } from "@/components/ui/button";

import {
  DEFAULT_VISIBLE_COLUMNS,
  ORDER_COLUMN_SEARCH_LABELS,
  ORDER_SEARCH_FIELDS,
  ORDER_TABLE_COLUMN_LABELS,
} from "../list-config";
import { formatMoney } from "../selectors";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { OrderColumnSearchKey, OrderTableColumnKey } from "../list-config";
import type { Order } from "../types";

export const STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({
  label: STATUS_LABEL_VI[value] ?? value,
  value,
}));

export const COLUMN_OPTIONS = DEFAULT_VISIBLE_COLUMNS.map((value) => ({
  label: ORDER_TABLE_COLUMN_LABELS[value],
  value,
}));

export const SEARCH_FIELD_VALUES = ORDER_SEARCH_FIELDS.map((field) => field.value);

interface BuildColumnsArgs {
  columnSearch: Record<string, string | undefined>;
  onColumnSearch: (key: OrderColumnSearchKey, value: string) => void;
}

export function buildOrderColumns({
  columnSearch,
  onColumnSearch,
}: BuildColumnsArgs): Record<OrderTableColumnKey, ColumnDef<Order>> {
  return {
    orderNumber: {
      key: "orderNumber",
      header: ORDER_TABLE_COLUMN_LABELS.orderNumber,
      sortable: true,
      compare: (a, b) => a.orderNumber.localeCompare(b.orderNumber),
      headerFilter: (
        <ColumnFilterButton
          value={columnSearch.orderNumber ?? ""}
          label={ORDER_COLUMN_SEARCH_LABELS.orderNumber}
          placeholder="Lọc mã đơn"
          onChange={(value) => onColumnSearch("orderNumber", value)}
        />
      ),
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    recipientName: {
      key: "recipientName",
      header: ORDER_TABLE_COLUMN_LABELS.recipientName,
      sortable: true,
      compare: (a, b) => a.recipientName.localeCompare(b.recipientName),
      headerFilter: (
        <ColumnFilterButton
          value={columnSearch.recipientName ?? ""}
          label={ORDER_COLUMN_SEARCH_LABELS.recipientName}
          placeholder="Tên / SĐT"
          onChange={(value) => onColumnSearch("recipientName", value)}
        />
      ),
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-ink-primary text-[0.8125rem]">{row.recipientName}</span>
          <span className="text-ink-tertiary font-[family-name:var(--font-mono)] text-xs">
            {row.recipientPhone}
          </span>
        </div>
      ),
    },
    placedAt: dateCell<Order>(
      "placedAt",
      ORDER_TABLE_COLUMN_LABELS.placedAt,
      (row) => row.placedAt,
      {
        sortable: true,
        compare: (a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime(),
      },
    ),
    grandTotal: moneyCell<Order>(
      "grandTotal",
      ORDER_TABLE_COLUMN_LABELS.grandTotal,
      (row) => row.grandTotal,
      (value) => formatMoney(value),
      { sortable: true, compare: (a, b) => a.grandTotal - b.grandTotal },
    ),
    status: statusCell<Order>(
      "status",
      ORDER_TABLE_COLUMN_LABELS.status,
      (row) => row.status,
      "order",
      { sortable: true, compare: (a, b) => a.status.localeCompare(b.status), withIcon: true },
    ),
    actions: {
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
          <Link href={ADMIN_ROUTES.orders.detail(row.orderId)} aria-label="Xem chi tiết đơn hàng">
            <Eye className="size-3.5" />
          </Link>
        </Button>
      ),
    },
  };
}
