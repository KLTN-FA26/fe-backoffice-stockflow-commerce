"use client";

import Link from "next/link";
import { Eye } from "lucide-react";

import { ADMIN_ROUTES } from "@/constants";
import { formatMoney } from "@/lib/format";
import { CELL, dateCell, stackCell, statusCell } from "@/components/shared/column-helpers";
import { rowActionsColumn } from "@/components/shared/RowActionsMenu";

import { COLUMN_LABELS } from "./constants";
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
        <Link
          href={ADMIN_ROUTES.orders.detail(row.orderId)}
          className={`${CELL.code} hover:underline`}
          onClick={(event) => event.stopPropagation()}
        >
          {row.orderNumber}
        </Link>
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
    // "Phương thức TT" / "Thanh toán" đã bỏ (WF-05 BO-08): BE không còn trả trên đơn (4B-10), tiền ở các đợt thanh toán
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
    {
      ...statusCell<Order>("status", COLUMN_LABELS.status, (row) => row.status, "order", {
        sortable: true,
        withIcon: true,
      }),
      key: "status",
    },
    // bo-17: việc tiếp theo suy ra từ trạng thái / lý do giữ / kho xuất của dòng. Đã thu / còn phải thu không có trên
    // dòng `GET /orders` (ở các đợt của hợp đồng) nên danh sách chưa có cột thanh toán.
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
