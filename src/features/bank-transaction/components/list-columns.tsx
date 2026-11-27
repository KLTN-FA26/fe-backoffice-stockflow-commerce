"use client";

import Link from "next/link";

import { BANK_TRANSACTION_LABELS, BANK_TRANSACTION_ROUTES } from "@/constants/bank-transaction";
import { formatDateTime } from "@/lib/format/date";
import { formatMoney } from "@/lib/format/money";

import { reviewReasonText } from "../selectors";

import { BankTransactionStatusDot, MONO } from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { BankTransaction } from "../types";

/**
 * 5 cột dữ liệu — ngày giao dịch là link sang chi tiết (bấm cả dòng cũng mở chi tiết, `onRowClick`); cột "Thao tác"
 * do trang thêm (`rowActionsColumn`).
 */
export const BANK_TRANSACTION_COLUMNS: ColumnDef<BankTransaction>[] = [
  {
    key: "transactionAt",
    header: BANK_TRANSACTION_LABELS.columnTime,
    cell: (row) => (
      <Link
        href={BANK_TRANSACTION_ROUTES.detail(row.id)}
        onClick={(event) => event.stopPropagation()}
        className={`${MONO} text-accent-text text-[0.8125rem] font-medium hover:underline`}
      >
        {formatDateTime(row.transactionAt ?? row.receivedAt)}
      </Link>
    ),
  },
  {
    key: "amount",
    header: "Số tiền",
    align: "right",
    cell: (row) => (
      <span className={`${MONO} text-ink-primary`}>{formatMoney(row.amount, row.currency)}</span>
    ),
  },
  {
    key: "content",
    header: "Nội dung chuyển khoản",
    className: "min-w-72",
    cell: (row) => (
      <div className="flex flex-col whitespace-normal">
        <span className={`${MONO} text-ink-primary text-[0.8125rem]`}>{row.content ?? "—"}</span>
        {row.status === "NEEDS_REVIEW" && row.reviewReason && (
          <span className="text-ink-secondary text-xs">{reviewReasonText(row.reviewReason)}</span>
        )}
      </div>
    ),
  },
  {
    key: "customer",
    header: "Khách (gợi ý)",
    cell: (row) =>
      row.customerName || row.customerCode ? (
        <div className="flex flex-col">
          <span className="text-[0.8125rem]">{row.customerName ?? row.customerCode}</span>
          {row.customerName && row.customerCode && (
            <span className={`${MONO} text-ink-tertiary text-xs`}>{row.customerCode}</span>
          )}
        </div>
      ) : (
        <span className="text-ink-tertiary">—</span>
      ),
  },
  {
    key: "status",
    header: "Trạng thái",
    cell: (row) => <BankTransactionStatusDot status={row.status} />,
  },
];
