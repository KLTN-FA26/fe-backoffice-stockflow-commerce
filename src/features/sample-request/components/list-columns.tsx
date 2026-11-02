"use client";

import Link from "next/link";

import {
  ADMIN_ROUTES,
  PRODUCTION_STATUS_BY_API,
  SAMPLE_API_STATUSES,
  SAMPLE_STATUS_BY_API,
} from "@/constants";

import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate } from "@/lib/format/date";

import { sampleStatusLabel } from "@/features/sample-request/selectors";

import { CustomerName } from "@/components/backoffice/CustomerName";
import { StatusDot } from "@/components/shared/StatusDot";

import { MONO } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { SampleRow } from "@/features/sample-request/types";

export const STATUS_OPTIONS = SAMPLE_API_STATUSES.map((value) => ({
  value,
  label: sampleStatusLabel(value),
}));

export const SORTABLE = new Set(["requestNumber", "status", "dueDate", "createdAt"]);

export const COLUMNS: ColumnDef<SampleRow>[] = [
  {
    key: "requestNumber",
    header: "Mã yêu cầu",
    sortable: true,
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.sampleRequests.detail(row.id)}
        className={`text-accent font-medium hover:underline ${MONO}`}
        onClick={(event) => event.stopPropagation()}
      >
        {row.requestNumber}
      </Link>
    ),
  },
  {
    key: "round",
    header: "Lần",
    align: "right",
    cell: (row) => <span className={MONO}>{row.round}</span>,
  },
  { key: "customer", header: "Khách hàng", cell: (row) => <CustomerName id={row.customerId} /> },
  { key: "blankSku", header: "Phôi", cell: (row) => <span className={MONO}>{row.blankSku}</span> },
  {
    key: "quantity",
    header: "SL (cái)",
    align: "right",
    cell: (row) => <span className={MONO}>{row.quantity}</span>,
  },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    cell: (row) => <StatusDot domain="design" status={SAMPLE_STATUS_BY_API[row.status]} />,
  },
  {
    key: "production",
    header: "LSX mẫu",
    cell: (row) =>
      row.productionOrder ? (
        <Link
          href={ADMIN_ROUTES.productionOrders.detail(row.productionOrder.id)}
          className={`text-accent hover:underline ${MONO}`}
          title={STATUS_LABEL_VI[PRODUCTION_STATUS_BY_API[row.productionOrder.status]]}
          onClick={(event) => event.stopPropagation()}
        >
          {row.productionOrder.orderNumber}
        </Link>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
  {
    key: "dueDate",
    header: "Cần trước",
    sortable: true,
    align: "right",
    cell: (row) => (
      <span className="text-ink-secondary tabular-nums">
        {row.dueDate ? formatDate(row.dueDate) : "—"}
      </span>
    ),
  },
];
