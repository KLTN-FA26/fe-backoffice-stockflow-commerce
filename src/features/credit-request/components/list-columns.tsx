"use client";

import Link from "next/link";

import { CREDIT_REQUEST_LABELS, CREDIT_REQUEST_ROUTES } from "@/constants/credit-request";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { CreditRequestStatusDot } from "./CreditRequestStatusDot";
import { MONO } from "./copy";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { CreditRequest } from "../types";

/** Có dòng nào mang hạn mức hiện tại (kể cả null = chưa có) không — BE trước PR #497 không gửi field. */
export function hasCurrentLimit(rows: readonly CreditRequest[] | undefined): boolean {
  return (rows ?? []).some((row) => row.currentCreditLimit !== undefined);
}

/** "Hạn mức xin" — một số tiền, kỳ hạn bên dưới. */
const REQUESTED_COLUMN: ColumnDef<CreditRequest> = {
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
};

/**
 * bo-28: "Hạn mức hiện tại → xin" — Kế toán thấy ngay khách xin tăng bao nhiêu. Khách chưa có hạn mức thì vế trái là
 * "Chưa có".
 */
const CURRENT_TO_REQUESTED_COLUMN: ColumnDef<CreditRequest> = {
  key: "requested",
  header: "Hạn mức hiện tại → xin",
  align: "right",
  cell: (row) => (
    <div className="flex flex-col items-end">
      <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
        <span className={`${MONO} text-ink-secondary`}>
          {row.currentCreditLimit != null
            ? formatMoney(row.currentCreditLimit, row.currency)
            : CREDIT_REQUEST_LABELS.noCurrentLimit}
        </span>
        <span aria-hidden="true" className="text-ink-tertiary">
          →
        </span>
        <span className="sr-only">xin</span>
        <span className={`${MONO} text-ink-primary`}>
          {formatMoney(row.requestedLimit, row.currency)}
        </span>
      </span>
      <span className="text-ink-tertiary text-xs">{row.requestedTermDays} ngày</span>
    </div>
  ),
};

/** 5 cột dữ liệu (không cần ẩn hiện cột); cột khách là link sang chi tiết. `withCurrent`: BE gửi hạn mức hiện tại. */
export function creditRequestColumns(withCurrent: boolean): ColumnDef<CreditRequest>[] {
  return CREDIT_REQUEST_COLUMNS.map((column) =>
    column.key === "requested" && withCurrent ? CURRENT_TO_REQUESTED_COLUMN : column,
  );
}

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
  REQUESTED_COLUMN,
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
