"use client";

import Link from "next/link";

import { CREDIT_REQUEST_LABELS, CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { CreditRequestStatusDot } from "./CreditRequestStatusDot";
import { MONO } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CreditRequest } from "../types";

/** 5 cột dữ liệu (không cần ẩn hiện cột); cột khách là link sang chi tiết. */
export const CREDIT_REQUEST_COLUMNS: ColumnDef<CreditRequest>[] = [
  {
    key: "customer",
    header: "Khách hàng",
    cell: (row) => (
      <div className="flex flex-col items-start">
        <Link
          href={CREDIT_REQUEST_ROUTES.detail(row.id)}
          className="text-accent-text text-[0.8125rem] font-medium hover:underline"
        >
          {row.customerName ?? row.customerCode ?? "Khách hàng"}
        </Link>
        <span className="text-ink-tertiary text-xs">
          {row.customerCode && <span className={MONO}>{row.customerCode} · </span>}
          {CREDIT_REQUEST_LABELS.source[row.source] ?? row.source}
        </span>
      </div>
    ),
  },
  {
    key: "requested",
    header: "Hạn mức xin",
    align: "right",
    cell: (row) => (
      <div className="flex flex-col items-end">
        <span className={`${MONO} text-ink-primary`}>
          {formatMoney(row.requestedLimit, row.currency)}
        </span>
        <span className="text-ink-tertiary text-xs">{row.requestedTermDays} ngày</span>
      </div>
    ),
  },
  {
    key: "status",
    header: "Trạng thái",
    cell: (row) => <CreditRequestStatusDot status={row.status} />,
  },
  {
    key: "submittedAt",
    header: "Gửi lúc",
    align: "right",
    cell: (row) => <span className="tabular-nums">{formatDateTime(row.submittedAt)}</span>,
  },
  {
    key: "submittedBy",
    header: "Người gửi",
    cell: (row) => <span>{row.submittedByName ?? "—"}</span>,
  },
];
