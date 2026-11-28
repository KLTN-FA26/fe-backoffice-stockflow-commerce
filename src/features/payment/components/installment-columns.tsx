"use client";

import Link from "next/link";
import { AlertTriangle, CalendarX2 } from "lucide-react";

import { ADMIN_ROUTES, ORDER_PERMISSIONS } from "@/constants";
import { PAYMENT_LABELS, PAYMENT_LIST_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { formatDate } from "@/lib/format/date";
import { CustomerName } from "@/components/backoffice/CustomerName";

import {
  blocksHandover,
  daysOverdue,
  deliveryBatchLabel,
  installmentMilestoneLabel,
} from "../selectors";

import {
  CodeLink,
  DateCell,
  InstallmentLabel,
  InstallmentStatusDot,
  MoneyCell,
} from "./primitives";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Installment } from "../types";

const C = PAYMENT_LIST_LABELS.installmentColumns;
const L = PAYMENT_LABELS.installments;

/** Cột có thể sắp xếp theo BE (`InstallmentService.SORT`). */
export const INSTALLMENT_SORTABLE = new Set(["dueDate", "amount", "status"]);

/**
 * Thứ tự cột (BO-UX-38): hạn trả và còn phải thu ngay sau đợt — kế toán nhìn hai số đó trước, hợp đồng / mốc / đơn
 * sau. Cột thao tác ghim phải (L-2).
 */
export const INSTALLMENT_COLUMNS = [
  "contract",
  "customer",
  "installment",
  "dueDate",
  "outstanding",
  "status",
  "amount",
  "paid",
  "order",
  "milestone",
  "batch",
  "actions",
] as const;
export type InstallmentColumn = (typeof INSTALLMENT_COLUMNS)[number];
/**
 * Ẩn mặc định, bật lại qua Ẩn hiện cột: "Đợt giao" (chỉ cần khi soát chặn bàn giao), "Đã thu" (= số tiền − còn phải
 * thu) và "Mốc" (tên đợt đã nói mốc) — để bảng vừa 1440px, cột "Thao tác" không bị đẩy ra ngoài (bo-22).
 */
const HIDDEN_BY_DEFAULT: readonly InstallmentColumn[] = ["batch", "paid", "milestone"];
export const INSTALLMENT_DEFAULT_COLUMNS: readonly InstallmentColumn[] = INSTALLMENT_COLUMNS.filter(
  (column) => !HIDDEN_BY_DEFAULT.includes(column),
);
export const INSTALLMENT_LOCKED_COLUMNS: readonly InstallmentColumn[] = ["contract", "actions"];
export const INSTALLMENT_COLUMN_LABELS: Record<InstallmentColumn, string> = C;

/**
 * Trạng thái THẬT của đợt (Đến hạn / Thanh toán một phần…) + nhãn "Quá hạn N ngày" khi có cờ `overdue` (BO-UX-37):
 * quá hạn không thay mất "thanh toán một phần". Chữ màu ink, tông nằm ở icon.
 */
export function InstallmentStatusCell({ row }: { row: Installment }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <InstallmentStatusDot status={row.status} />
      {row.overdue && (
        <span className="text-ink-primary inline-flex items-center gap-1 text-xs font-medium">
          <CalendarX2 className="text-dot-danger size-3.5" aria-hidden="true" />
          {PAYMENT_LIST_LABELS.overdueDays(daysOverdue(row))}
        </span>
      )}
    </span>
  );
}

/**
 * Cột bảng đợt thanh toán (docs 15 §5.1). `actions` là ô thao tác của từng dòng (lập phiếu thu); `omit` bỏ cột lặp
 * lại trên trang chỉ một đơn (BO-UX-42: hợp đồng, đơn, khách giống nhau ở mọi dòng).
 */
export function buildInstallmentColumns(
  actions?: (row: Installment) => React.ReactNode,
  omit: readonly InstallmentColumn[] = [],
): ColumnDef<Installment>[] {
  const columns: ColumnDef<Installment>[] = [
    {
      key: "contract",
      header: C.contract,
      cell: (row) => (
        <CodeLink href={PAYMENT_ROUTES.installments.detail(row.installmentId)}>
          {row.contractNumber}
        </CodeLink>
      ),
    },
    {
      key: "customer",
      header: C.customer,
      cell: (row) => (
        <CustomerName id={row.customerId} name={row.customerName} code={row.customerCode} />
      ),
    },
    {
      key: "installment",
      header: C.installment,
      // Tên đợt dài ("2 — Thanh toán sau đợt 1") được xuống dòng để nhường chỗ cho các cột số tiền
      className: "min-w-28 whitespace-normal",
      // Trang một đơn bỏ cột hợp đồng (link chi tiết): tên đợt thành link thay
      // S07-1: bỏ cả cột mốc / đợt giao thì mốc, đợt giao gắn kèm và cờ chặn bàn giao chuyển xuống dòng phụ dưới tên đợt.
      cell: (row) => {
        const name = omit.includes("contract") ? (
          <Link
            href={PAYMENT_ROUTES.installments.detail(row.installmentId)}
            className="text-accent-text font-medium hover:underline"
          >
            <InstallmentLabel installment={row} />
          </Link>
        ) : (
          <span className="text-ink-primary">
            <InstallmentLabel installment={row} />
          </span>
        );
        const milestone = omit.includes("milestone");
        const batch = omit.includes("batch") && row.deliveryBatchSeq != null;
        const blocked = omit.includes("batch") && blocksHandover(row);
        if (!milestone && !batch && !blocked) return name;
        return (
          <span className="flex flex-col gap-0.5">
            {name}
            <span className="text-ink-secondary flex flex-wrap items-center gap-x-1 text-xs">
              {milestone && <span>{installmentMilestoneLabel(row)}</span>}
              {milestone && batch && " · "}
              {batch && <span>{deliveryBatchLabel(row)}</span>}
              {blocked && (
                <span className="text-ink-primary ml-2 inline-flex items-center gap-1">
                  <AlertTriangle className="text-dot-warning size-3.5" aria-hidden="true" />
                  {L.handoverBlocked}
                </span>
              )}
            </span>
          </span>
        );
      },
    },
    {
      key: "dueDate",
      header: C.dueDate,
      sortable: true,
      align: "right",
      // Đợt quá hạn: hạn trả chữ đỏ kèm icon — tín hiệu nằm ở ô, không tô cả dòng (data-table-mode-a)
      cell: (row) =>
        row.dueDate ? (
          row.overdue ? (
            <span className="text-danger inline-flex items-center gap-1 font-medium tabular-nums">
              <CalendarX2 className="size-3.5" aria-hidden="true" />
              {formatDate(row.dueDate)}
            </span>
          ) : (
            <DateCell iso={row.dueDate} />
          )
        ) : (
          <span className="text-ink-tertiary">{L.noDueDate}</span>
        ),
    },
    {
      key: "outstanding",
      header: C.outstanding,
      align: "right",
      cell: (row) => <MoneyCell amount={row.outstanding} currency={row.currency} />,
    },
    {
      key: "status",
      header: C.status,
      sortable: true,
      cell: (row) => <InstallmentStatusCell row={row} />,
    },
    {
      key: "amount",
      header: C.amount,
      sortable: true,
      align: "right",
      cell: (row) => <MoneyCell amount={row.amount} currency={row.currency} />,
    },
    {
      key: "paid",
      header: C.paid,
      align: "right",
      cell: (row) => <MoneyCell amount={row.paidAmount} currency={row.currency} />,
    },
    {
      key: "order",
      header: C.order,
      // AUTH-8: người xem không mở được trang đơn thì số đơn chỉ là chữ
      cell: (row) => (
        <CodeLink
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          permission={ORDER_PERMISSIONS.viewPage}
        >
          {row.orderNumber}
        </CodeLink>
      ),
    },
    { key: "milestone", header: C.milestone, cell: (row) => installmentMilestoneLabel(row) },
    {
      key: "batch",
      header: C.batch,
      cell: (row) => (
        <span className="text-ink-secondary">
          {deliveryBatchLabel(row)}
          {blocksHandover(row) && (
            // BO-UX-1: chữ màu ink, tông cảnh báo ở icon
            <span className="text-ink-primary ml-2 inline-flex items-center gap-1 text-xs">
              <AlertTriangle className="text-dot-warning size-3.5" aria-hidden="true" />
              {L.handoverBlocked}
            </span>
          )}
        </span>
      ),
    },
  ];
  if (actions)
    columns.push({
      key: "actions",
      header: C.actions,
      align: "right",
      sticky: "right",
      className: "w-20",
      cell: actions,
    });
  return columns.filter((column) => !omit.some((key) => key === column.key));
}
