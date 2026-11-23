"use client";

import Link from "next/link";

import { ADMIN_ROUTES, CUSTOMER_FALLBACK_LABEL } from "@/constants";
import { daysBetween, todayIso } from "@/lib/date-range";
import { formatMoney } from "@/lib/format";
import { formatDate, formatDateTime, toLocalIsoDate } from "@/lib/format/date";

import { creditHoldSummary } from "../../selectors";

import { useCustomerCreditPosition } from "./useCustomerCreditPosition";

import type { ReactNode } from "react";
import type { ColumnDef } from "@/components/shared/DataTable";
import type { CreditHold } from "../../types";

type CreditHoldColumn = ColumnDef<CreditHold> & { key: string };

const MONEY = "font-[family-name:var(--font-mono)] tabular-nums";

export const CREDIT_HOLD_COLUMNS = [
  "orderNumber",
  "customer",
  "placedAt",
  "orderAmount",
  "exposure",
  "creditLimit",
  "creditSummary",
  "overdue",
  "waiting",
  "actions",
] as const;
export type CreditHoldColumnKey = (typeof CREDIT_HOLD_COLUMNS)[number];
export const CREDIT_HOLD_LOCKED_COLUMNS: readonly CreditHoldColumnKey[] = [
  "orderNumber",
  "actions",
];
export const CREDIT_HOLD_COLUMN_LABELS: Record<CreditHoldColumnKey, string> = {
  orderNumber: "Mã đơn",
  customer: "Khách hàng",
  placedAt: "Ngày đặt",
  orderAmount: "Phần trả sau giao",
  exposure: "Dư nợ lúc kiểm",
  creditLimit: "Hạn mức",
  creditSummary: "Tình trạng công nợ",
  overdue: "Quá hạn hiện tại",
  waiting: "Chờ duyệt",
  actions: "Thao tác",
};

function money(row: CreditHold, amount: number, className = "text-ink-primary") {
  return <span className={`${MONEY} ${className}`}>{formatMoney(amount, row.order.currency)}</span>;
}

/**
 * Khoản quá hạn HIỆN TẠI của khách (BO-UX-32): "x ₫ · N ngày" (N tính từ đợt quá hạn cũ nhất). Chỉ gọi
 * `GET /orders/credit-position/{customerId}` cho dòng giữ vì nợ quá hạn (phần vượt = 0) — dòng vượt hạn mức đã tự nói lý
 * do bằng số vượt, nên hàng đợi không gọi theo từng dòng cho chúng. Cùng query key với panel của hộp thoại duyệt nên mở
 * dialog không gọi lại. Thiếu quyền đọc hồ sơ tín dụng / tải lỗi → "—" (không đoán số).
 */
function OverdueCell({ row }: { row: CreditHold }) {
  const position = useCustomerCreditPosition(row.order.customerId);
  if (!position.available || position.isError) return <span className="text-ink-tertiary">—</span>;
  if (position.isPending || !position.data)
    return <span className="text-ink-tertiary text-xs">Đang tải…</span>;
  const { overdueAmount, oldestOverdueDueDate, currency } = position.data;
  if (overdueAmount <= 0) return <span className="text-ink-tertiary text-xs">Không quá hạn</span>;
  const days = oldestOverdueDueDate ? daysBetween(oldestOverdueDueDate, todayIso()) : null;
  return (
    <span className="flex flex-col items-end">
      <span className={`${MONEY} text-ink-primary text-[0.8125rem] font-medium`}>
        {formatMoney(overdueAmount, currency)}
      </span>
      {days !== null && days > 0 && (
        <span className="text-ink-secondary text-xs">quá hạn {days} ngày</span>
      )}
    </span>
  );
}

/** Số ngày đơn chờ quyết định, tính từ lúc kiểm hạn mức (lúc đơn bị giữ); dòng phụ là giờ kiểm. */
function WaitingCell({ row }: { row: CreditHold }) {
  const days = daysBetween(toLocalIsoDate(row.checkedAt), todayIso());
  return (
    <span className="flex flex-col">
      <span className="text-ink-primary text-[0.8125rem] tabular-nums">
        {days <= 0 ? "Hôm nay" : `${days} ngày`}
      </span>
      <span className="text-ink-tertiary text-xs tabular-nums">
        kiểm {formatDateTime(row.checkedAt)}
      </span>
    </span>
  );
}

/**
 * Cột danh sách đơn vượt hạn mức. Hạn mức / dư nợ / phần trả sau giao là giá trị BE ghi lúc kiểm (`checkedAt`, nhãn
 * "lúc kiểm") — docs 14 BR-06: dư nợ hiện tại + giá trị đơn ≤ hạn mức; vượt = phần chênh. Quá hạn là số HIỆN TẠI.
 */
export function buildCreditHoldColumns(
  renderActions: (row: CreditHold) => ReactNode,
  /**
   * ACCOUNTANT (người duyệt) không có quyền `sales-orders` (BE seed) → mã đơn không là link.
   * UI-only — Backend phải re-check (GET /orders/{id} @RequiresPermission sales-orders:READ).
   */
  canOpenOrder: boolean,
): CreditHoldColumn[] {
  const L = CREDIT_HOLD_COLUMN_LABELS;
  return [
    {
      key: "orderNumber",
      header: L.orderNumber,
      cell: (row) =>
        canOpenOrder ? (
          <Link
            href={ADMIN_ROUTES.orders.detail(row.order.orderId)}
            className="text-accent-text font-[family-name:var(--font-mono)] text-[0.8125rem] font-medium hover:underline"
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
      header: L.customer,
      cell: (row) => (
        <div className="flex flex-col">
          {/* Không có tên → nhãn trung tính, không hiện mảnh UUID (BO-UX-6) */}
          <span className="text-ink-primary text-[0.8125rem]">
            {row.order.customerName || row.order.recipientName || CUSTOMER_FALLBACK_LABEL}
          </span>
          {row.order.customerCode && (
            <span className="text-ink-tertiary max-w-40 truncate font-[family-name:var(--font-mono)] text-xs">
              {row.order.customerCode}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "placedAt",
      header: L.placedAt,
      cell: (row) => (
        <span className="text-ink-secondary text-[0.8125rem] tabular-nums">
          {formatDate(row.order.placedAt)}
        </span>
      ),
    },
    {
      key: "orderAmount",
      header: L.orderAmount,
      align: "right",
      cell: (r) => money(r, r.orderAmount),
    },
    { key: "exposure", header: L.exposure, align: "right", cell: (r) => money(r, r.exposure) },
    {
      key: "creditLimit",
      header: L.creditLimit,
      align: "right",
      cell: (r) => money(r, r.creditLimit),
    },
    {
      // Tình trạng suy từ số liệu lúc kiểm, KHÔNG phải lý do giữ BE lưu — xem `creditHoldSummary`
      key: "creditSummary",
      header: L.creditSummary,
      align: "right",
      cell: (r) => {
        const summary = creditHoldSummary(r);
        return summary.kind === "over-limit" ? (
          <span className="text-danger text-[0.8125rem] font-medium">
            Vượt hạn mức {money(r, summary.excess, "text-danger")}
          </span>
        ) : (
          <span className="text-danger text-[0.8125rem] font-medium">Khách có công nợ quá hạn</span>
        );
      },
    },
    {
      key: "overdue",
      header: L.overdue,
      align: "right",
      cell: (r) =>
        creditHoldSummary(r).kind === "overdue" ? (
          <OverdueCell row={r} />
        ) : (
          <span className="text-ink-tertiary">—</span>
        ),
    },
    { key: "waiting", header: L.waiting, cell: (r) => <WaitingCell row={r} /> },
    { key: "actions", header: L.actions, align: "right", sticky: "right", cell: renderActions },
  ];
}
