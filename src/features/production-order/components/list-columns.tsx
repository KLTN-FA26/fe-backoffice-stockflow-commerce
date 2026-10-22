"use client";

import Link from "next/link";

import { ADMIN_ROUTES, PRODUCTION_API_STATUSES } from "@/constants";

import { formatDate } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";

import { isOverdue, productionStatusLabel } from "@/features/production-order/selectors";

import { MONO, ProductionStatus, TYPE_LABEL } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { ProductionRow } from "@/features/production-order/types";

export const STATUS_OPTIONS = PRODUCTION_API_STATUSES.map((value) => ({
  value,
  label: productionStatusLabel(value),
}));

export const SORTABLE = new Set(["orderNumber", "status", "dueDate", "createdAt"]);

export function columns(today: string): ColumnDef<ProductionRow>[] {
  return [
    {
      key: "orderNumber",
      header: "Số LSX",
      sortable: true,
      cell: (row) => (
        <Link
          href={ADMIN_ROUTES.productionOrders.detail(row.id)}
          className={`text-accent font-medium hover:underline ${MONO}`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "type",
      header: "Loại",
      cell: (row) => <span className="text-ink-secondary">{TYPE_LABEL[row.type]}</span>,
    },
    {
      key: "status",
      header: "Trạng thái",
      sortable: true,
      cell: (row) => <ProductionStatus row={row} />,
    },
    {
      key: "blankSku",
      header: "Phôi",
      cell: (row) => <span className={MONO}>{row.blankSku}</span>,
    },
    {
      key: "qty",
      header: "Đạt / KH (cái)",
      align: "right",
      cell: (row) => (
        <span className={MONO}>
          {formatNumber(row.goodQuantity)} / {formatNumber(row.plannedQuantity)}
        </span>
      ),
    },
    {
      key: "dueDate",
      header: "Hạn giao",
      sortable: true,
      align: "right",
      cell: (row) => (
        <span
          className={`tabular-nums ${isOverdue(row, today) ? "text-danger font-medium" : "text-ink-secondary"}`}
        >
          {row.dueDate ? formatDate(row.dueDate) : "—"}
        </span>
      ),
    },
    {
      // SCRUM-412: khu PACKING nhận hàng khi LSX đơn hoàn tất (bàn giao tự động, BE PR #109).
      key: "packingLocation",
      header: "Khu đóng gói",
      cell: (row) =>
        row.packingLocation ? (
          <span className={MONO}>{row.packingLocation}</span>
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
    {
      key: "source",
      header: "Nguồn",
      cell: (row) =>
        row.sampleRequestId ? (
          <Link
            href={ADMIN_ROUTES.sampleRequests.detail(row.sampleRequestId)}
            className="text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Yêu cầu mẫu
          </Link>
        ) : row.salesOrderId ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.salesOrderId)}
            className="text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Đơn bán
          </Link>
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
  ];
}
