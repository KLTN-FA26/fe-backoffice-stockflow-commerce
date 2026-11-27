"use client";

import Link from "next/link";
import { Eye, FilePlus2, FileText } from "lucide-react";

import { ADMIN_ROUTES, CUSTOMER_API_STATUSES, CUSTOMER_STATUS_BY_API } from "@/constants";
import { PERMISSION_UI } from "@/constants/permissions";

import { STATUS_LABEL_VI } from "@/lib/domain/status-map";
import { formatDate } from "@/lib/format/date";

import { rowActionsColumn } from "@/components/shared/RowActionsMenu";
import { StatusDot } from "@/components/shared/StatusDot";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { RowAction } from "@/components/shared/RowActionsMenu";
import type { Customer } from "@/features/customer/types";

export const MONO = "font-[family-name:var(--font-mono)] text-[0.8125rem] tabular-nums";

export const STATUS_OPTIONS = CUSTOMER_API_STATUSES.map((value) => ({
  value,
  label: STATUS_LABEL_VI[CUSTOMER_STATUS_BY_API[value]] ?? CUSTOMER_STATUS_BY_API[value],
}));

export const CUSTOMER_COLUMNS = [
  "fullName",
  "email",
  "phone",
  "status",
  "createdAt",
  "actions",
] as const;
export type CustomerColumn = (typeof CUSTOMER_COLUMNS)[number];
/** Cột tên (link sang chi tiết) và cột thao tác luôn hiện (data-table-mode-a §4.2). */
export const CUSTOMER_LOCKED_COLUMNS: readonly CustomerColumn[] = ["fullName", "actions"];
export const CUSTOMER_COLUMN_LABELS: Record<CustomerColumn, string> = {
  fullName: "Khách hàng",
  email: "Email",
  phone: "Điện thoại",
  status: "Trạng thái",
  createdAt: "Ngày tạo",
  actions: "Thao tác",
};

const DATA_COLUMNS: ColumnDef<Customer>[] = [
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

/**
 * Thao tác của dòng (backoffice-erp-ui A6) — cùng gating với thẻ hành động ở chi tiết khách: tạo báo giá chỉ cho khách
 * đang hoạt động. Quyền UI-only — Backend phải re-check.
 */
function customerActions(
  row: Customer,
  can: { readQuote: boolean; createQuote: boolean },
): RowAction[] {
  const actions: RowAction[] = [
    { label: "Xem chi tiết", icon: Eye, href: ADMIN_ROUTES.customers.detail(row.customerId) },
  ];
  if (can.readQuote)
    actions.push({
      label: "Báo giá của khách",
      icon: FileText,
      href: ADMIN_ROUTES.quotes.byCustomer(row.customerId),
    });
  const active = row.status === "ACTIVE";
  actions.push({
    label: "Tạo báo giá",
    icon: FilePlus2,
    href:
      active && can.createQuote ? ADMIN_ROUTES.quotes.createForCustomer(row.customerId) : undefined,
    disabled: !active || !can.createQuote,
    hint: !can.createQuote
      ? PERMISSION_UI.quoteCreateDenied
      : !active
        ? "Chỉ khách đang hoạt động mới lập được báo giá."
        : undefined,
  });
  return actions;
}

export function buildCustomerColumns(can: {
  readQuote: boolean;
  createQuote: boolean;
}): ColumnDef<Customer>[] {
  return [
    ...DATA_COLUMNS,
    rowActionsColumn<Customer>((row) => ({
      label: `Thao tác — ${row.fullName}`,
      actions: customerActions(row, can),
    })),
  ];
}

export const SORTABLE = new Set(["fullName", "email", "status", "createdAt"]);
