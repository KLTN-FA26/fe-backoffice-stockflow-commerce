"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_API_STATUSES, CUSTOMER_STATUS_BY_API } from "@/constants";

import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate } from "@/lib/format/date";

import { StatusDot } from "@/components/shared/StatusDot";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Customer } from "@/features/customer/types";

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

export const STATUS_OPTIONS = CUSTOMER_API_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL_VI[CUSTOMER_STATUS_BY_API[value]] ?? CUSTOMER_STATUS_BY_API[value],
}));

export const COLUMNS: ColumnDef<Customer>[] = [
  {
    key: "fullName",
    header: "Khách hàng",
    sortable: true,
    cell: (row) => (
      <Link
        href={ADMIN_ROUTES.customers.detail(row.customerId)}
        className="text-ink-primary font-medium hover:underline"
        onClick={(event) => event.stopPropagation()}
      >
        {row.fullName}
      </Link>
    ),
  },
  {
    key: "email",
    header: "Email",
    sortable: true,
    cell: (row) => <span className="text-ink-secondary break-all">{row.email}</span>,
  },
  {
    key: "phone",
    header: "Điện thoại",
    cell: (row) => <span className={`text-ink-secondary ${MONO}`}>{row.phone ?? "—"}</span>,
  },
  {
    key: "taxCode",
    header: "Mã số thuế",
    cell: (row) => <span className={`text-ink-secondary ${MONO}`}>{row.taxCode ?? "—"}</span>,
  },
  {
    key: "status",
    header: "Trạng thái",
    sortable: true,
    cell: (row) => <StatusDot domain="customer" status={CUSTOMER_STATUS_BY_API[row.status]} />,
  },
  {
    key: "createdAt",
    header: "Ngày tạo",
    sortable: true,
    align: "right",
    cell: (row) => (
      <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
        {formatDate(row.createdAt)}
      </span>
    ),
  },
];

export const SORTABLE = new Set(["fullName", "email", "status", "createdAt"]);
