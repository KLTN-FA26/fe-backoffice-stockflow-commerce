"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES, FEE_BEARER_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import {
  CELL,
  dateCell,
  EmptyCell,
  stackCell,
  statusCell,
} from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { COLUMN_LABELS, PAYMENT_CELL_LABELS } from "./constants";
import { CustomerCell } from "./CustomerCell";
import { orderListNextStep } from "./next-step";

import type { ColumnDef } from "@/components/shared/DataTable";
import type { Order } from "../../types";

type OrderColumn = ColumnDef<Order> & { key: string };

/**
 * Cột bảng đơn hàng. Sort phía server đúng whitelist BE (mã đơn, ngày đặt, tổng tiền, trạng thái) — Khách hàng / Người
 * nhận BE không sort được nên không có nút sort. Lọc trên header gắn ở `order-header-filters`.
 * `onFilterCustomer`: lọc nhanh theo khách của dòng (hiện tên khách BE kèm sẵn, BE-15).
 */
export function buildOrderColumns(onFilterCustomer: (customerId: string) => void): OrderColumn[] {
  return [
    {
      key: "orderNumber",
      header: COLUMN_LABELS.orderNumber,
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <Link
            href={ADMIN_ROUTES.orders.detail(row.orderId)}
            className={`${CELL.code} hover:underline`}
            onClick={(event) => event.stopPropagation()}
          >
            {row.orderNumber}
          </Link>
          {/* D50: công ty chịu một khoản phí của đơn — Kế toán thấy ngay ở danh sách */}
          {row.feeBorneByCompany && (
            <span className="bg-bg-muted text-ink-secondary border-border-default rounded-[var(--r-sm)] border px-1.5 py-px text-[0.6875rem] font-medium whitespace-nowrap">
              {FEE_BEARER_LABELS.badge}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      header: COLUMN_LABELS.customer,
      // bo-17: tên công ty dài xuống tối đa hai dòng thay vì cắt ở 160px; bảng 1440px không phải cuộn ngang.
      className: "min-w-52 whitespace-normal",
      cell: (row) => (
        <CustomerCell
          customerId={row.customerId}
          customerName={row.customerName}
          customerCode={row.customerCode}
          onFilter={onFilterCustomer}
        />
      ),
    },
    // Ô hai dòng: tên người nhận + SĐT
    stackCell<Order>(
      "recipient",
      COLUMN_LABELS.recipient,
      (row) => row.recipientName,
      (row) => row.recipientPhone,
    ),
    dateCell<Order>("placedAt", COLUMN_LABELS.placedAt, (row) => row.placedAt, { sortable: true }),
    // "Phương thức TT" đã bỏ (WF-05 BO-08): BE không còn trả trên đơn (4B-10), tiền ở các đợt thanh toán.
    // Không dùng moneyCell: tiền tệ lấy từ `currency` của từng đơn (api-conventions §10).
    {
      key: "totalAmount",
      header: COLUMN_LABELS.totalAmount,
      align: "right",
      sortable: true,
      cell: (row) => (
        <span className={CELL.number}>{formatMoney(row.totalAmount, row.currency)}</span>
      ),
    },
    // bo-17: đã thu / còn phải thu của các đợt (BE PR #497 kèm trên dòng `GET /orders`), phần quá hạn tô đỏ.
    {
      key: "payment",
      header: COLUMN_LABELS.payment,
      align: "right",
      cell: (row) => <PaymentCell order={row} />,
    },
    {
      ...statusCell<Order>("status", COLUMN_LABELS.status, (row) => row.status, "order", {
        sortable: true,
        withIcon: true,
      }),
      key: "status",
    },
    // bo-17: việc tiếp theo suy ra từ trạng thái / lý do giữ / kho xuất của dòng.
    {
      key: "nextStep",
      header: COLUMN_LABELS.nextStep,
      // Câu ngắn được xuống dòng — bảng 1440px không phải cuộn ngang vì cột này.
      className: "min-w-36 whitespace-normal",
      cell: (row) => {
        const step = orderListNextStep(row);
        return step ? (
          <span className="text-ink-secondary text-[0.8125rem]">{step}</span>
        ) : (
          <span className="text-ink-tertiary text-xs">—</span>
        );
      },
    },
    // Thao tác của dòng gom vào menu "⋯" (backoffice-erp-ui A6)
    rowActionsColumn<Order>((row) => ({
      label: `Thao tác — ${row.orderNumber}`,
      actions: [
        { label: "Xem chi tiết", icon: Eye, href: ADMIN_ROUTES.orders.detail(row.orderId) },
      ],
    })),
  ];
}

/**
 * Ô "Thanh toán": dòng đầu đã thu, dòng dưới còn phải thu, thêm "Quá hạn" màu đỏ khi có. null (đơn chưa có đợt) →
 * "Chưa có hợp đồng"; `undefined` (BE chưa trả field) → "—", nhưng khi đó danh sách đã ẩn cả cột.
 */
function PaymentCell({ order }: { order: Order }) {
  const { paidAmount, outstandingAmount, overdueAmount, currency } = order;
  if (paidAmount === undefined && outstandingAmount === undefined) return <EmptyCell />;
  if (paidAmount == null || outstandingAmount == null) {
    return <span className={CELL.sub}>{PAYMENT_CELL_LABELS.noContract}</span>;
  }
  const overdue = overdueAmount ?? 0;
  return (
    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap">
      <span className={CELL.number}>
        <span className={CELL.sub}>{PAYMENT_CELL_LABELS.paid} </span>
        {formatMoney(paidAmount, currency)}
      </span>
      <span className={CELL.sub}>
        {PAYMENT_CELL_LABELS.outstanding} {formatMoney(outstandingAmount, currency)}
      </span>
      {overdue > 0 && (
        <span className="text-danger text-xs font-medium tabular-nums">
          {PAYMENT_CELL_LABELS.overdue} {formatMoney(overdue, currency)}
        </span>
      )}
    </div>
  );
}
