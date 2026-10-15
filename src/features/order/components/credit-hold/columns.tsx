"use client";

import Link from "next/link";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format";
import { formatDate, formatDateTime } from "@/lib/format/date";

import { creditHoldReason } from "../../selectors";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CreditHold } from "../../types";

type CreditHoldColumn = ColumnDef<CreditHold> & { key: string };

const MONEY = "font-[family-name:var(--font-mono)] tabular-nums";

function money(row: CreditHold, amount: number, className = "text-ink-primary") {
  return <span className={`${MONEY} ${className}`}>{formatMoney(amount, row.order.currency)}</span>;
}

/**
 * Cột danh sách đơn vượt hạn mức. Số liệu là giá trị BE ghi lúc kiểm hạn mức (`checkedAt`) —
 * docs 14 BR-06: dư nợ hiện tại + giá trị đơn ≤ hạn mức; vượt = phần chênh.
 */
export function buildCreditHoldColumns(
  renderActions: (row: CreditHold) => ReactNode,
  /**
   * ACCOUNTANT (người duyệt) không có quyền `sales-orders` (BE seed) → mã đơn không là link.
   * UI-only — Backend phải re-check (GET /orders/{id} @RequiresPermission sales-orders:READ).
   */
  canOpenOrder: boolean,
): CreditHoldColumn[] {
  return [
    {
      key: "orderNumber",
      header: "Mã đơn",
      cell: (row) =>
        canOpenOrder ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.order.orderId)}
            className="text-accent font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
          >
            {row.order.orderNumber}
          </Link>
        ) : (
          <span className="text-ink-primary font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium">
            {row.order.orderNumber}
          </span>
        ),
    },
    {
      key: "customer",
      header: "Khách hàng",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-ink-primary text-[0.8125rem]">
            {row.order.recipientName || "—"}
          </span>
          <span className="text-ink-tertiary max-w-40 truncate font-[family-name:var(--font-mono)] text-xs">
            {row.order.customerId ?? "—"}
          </span>
        </div>
      ),
    },
    {
      key: "placedAt",
      header: "Ngày đặt",
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
          {formatDate(row.order.placedAt)}
        </span>
      ),
    },
    {
      key: "orderAmount",
      header: "Giá trị đơn",
      align: "right",
      cell: (r) => money(r, r.orderAmount),
    },
    {
      key: "exposure",
      header: "Dư nợ hiện tại",
      align: "right",
      cell: (r) => money(r, r.exposure),
    },
    { key: "creditLimit", header: "Hạn mức", align: "right", cell: (r) => money(r, r.creditLimit) },
    {
      // Lý do suy từ số liệu lúc kiểm — xem `creditHoldReason` (BE chưa trả outcome)
      key: "reason",
      header: "Lý do giữ",
      align: "right",
      cell: (r) => {
        const reason = creditHoldReason(r);
        return reason.kind === "over-limit" ? (
          <span className="text-danger text-[0.8125rem] font-medium">
            Vượt hạn mức {money(r, reason.excess, "text-danger")}
          </span>
        ) : (
          <span className="text-danger text-[0.8125rem] font-medium">Khách có công nợ quá hạn</span>
        );
      },
    },
    {
      key: "checkedAt",
      header: "Kiểm lúc",
      cell: (row) => (
        <span className="text-ink-secondary text-xs tabular-nums">
          {formatDateTime(row.checkedAt)}
        </span>
      ),
    },
    { key: "actions", header: "", align: "right", cell: renderActions },
  ];
}
