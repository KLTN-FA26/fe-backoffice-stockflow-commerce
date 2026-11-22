import { Fragment } from "react";
import Link from "next/link";

import {
  ADMIN_ROUTES,
  CUSTOMER_FALLBACK_LABEL,
  ORDER_DELIVERY_FAILURE_LABELS,
  WAREHOUSE_PERMISSIONS,
} from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import { canChangeShippingAddress } from "../shipping-address";

import { OrderShippingAddressAction } from "./OrderShippingAddressAction";

import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
}

const EMPTY = "—";

/**
 * Kho xuất đã chọn khi release (SCRUM-423). Tên kho tra qua danh mục `GET /warehouses` (mọi trạng
 * thái — kho có thể đã ngừng hoạt động sau khi release), chỉ khi có `warehouse-warehouses:READ`:
 * thiếu quyền (vd ORDER_COORDINATOR trước BE V20261022000100) thì không gọi API, báo không xem được tên.
 * UI-only — Backend phải re-check (WarehouseController @RequiresPermission warehouse-warehouses:READ).
 * Không tìm thấy tên (đang tải, hoặc kho không còn trong danh mục) → nhãn trung tính, không hiện UUID kho (BO-UX-6).
 */
function WarehouseName({ warehouseId }: { warehouseId: string }) {
  const can = usePermissionChecker();
  const canRead = can(WAREHOUSE_PERMISSIONS.read);
  const { data } = useWarehouseDirectory(canRead);
  const warehouse = data?.find((w) => w.warehouseId === warehouseId);
  if (warehouse) return <span>{warehouse.name}</span>;
  return (
    <span className="text-ink-secondary">
      {canRead ? "Đã chọn kho xuất" : "Đã chọn kho — tài khoản chưa có quyền xem tên kho"}
    </span>
  );
}

/** Mốc thời gian vòng đời đơn (BE PR #133) — chỉ hiện mốc đã có. */
const MILESTONES = [
  ["packedAt", "Đóng gói xong"],
  ["shippedAt", "Bàn giao vận chuyển"],
  ["deliveredAt", "Đã giao"],
  ["completedAt", "Hoàn tất"],
  ["closedAt", "Đã đóng sổ"],
] as const satisfies readonly (readonly [keyof Order, string])[];

export function OrderInfoCard({ order, can }: OrderInfoCardProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Thông tin</h2>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
        <dt className="text-ink-secondary">Mã đơn</dt>
        <dd className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
          {order.orderNumber}
        </dd>
        <dt className="text-ink-secondary">Khách hàng</dt>
        <dd className="text-ink-primary min-w-0">
          {/* L-4: tên và mã khách trên hai dòng — không còn "Khách hàng demo0399990001". */}
          <span className="block truncate">
            {order.customerId
              ? order.customerName || order.customerCode || CUSTOMER_FALLBACK_LABEL
              : EMPTY}
          </span>
          {order.customerName && order.customerCode && (
            <span className="text-ink-secondary block font-[family-name:var(--font-mono)] text-xs">
              {order.customerCode}
            </span>
          )}
        </dd>
        {order.sourceQuoteId && (
          <>
            <dt className="text-ink-secondary">Báo giá</dt>
            <dd className="text-ink-primary">
              {/* BO-UX-25: quay về báo giá nguồn để so giá đã chốt (R5-7). */}
              <Link
                href={ADMIN_ROUTES.quotes.detail(order.sourceQuoteId)}
                className="text-accent-text hover:underline"
              >
                Từ báo giá{" "}
                <span className="font-[family-name:var(--font-mono)]">
                  {order.sourceQuoteNumber ?? ""}
                </span>
              </Link>
            </dd>
          </>
        )}
        <dt className="text-ink-secondary">Ngày đặt</dt>
        <dd className="text-ink-primary tabular-nums">{formatDate(order.placedAt)}</dd>
        <dt className="text-ink-secondary">Người nhận</dt>
        <dd className="text-ink-primary">
          {order.recipientName || EMPTY}
          {order.recipientPhone && ` · ${order.recipientPhone}`}
        </dd>
        <dt className="text-ink-secondary">Email</dt>
        <dd className="text-ink-primary">{order.contactEmail ?? EMPTY}</dd>
        <dt className="text-ink-secondary">Địa chỉ giao</dt>
        <dd className="text-ink-primary">
          {order.shippingAddressText ?? EMPTY}
          {/* Ẩn từ thùng đầu tiên dán nhãn (08 BR-04). UI-only — Backend phải re-check (BR-16, ORDER_ADDRESS_LOCKED) */}
          {canChangeShippingAddress(order, can) && (
            <span className="mt-0.5 block">
              <OrderShippingAddressAction order={order} />
            </span>
          )}
        </dd>
        <dt className="text-ink-secondary">Kho xuất</dt>
        <dd className="text-ink-primary">
          {order.warehouseId ? (
            <WarehouseName warehouseId={order.warehouseId} />
          ) : (
            "Chưa chọn kho xuất"
          )}
        </dd>
        {order.releasedAt && (
          <>
            <dt className="text-ink-secondary">Release lúc</dt>
            <dd className="text-ink-primary tabular-nums">{formatDateTime(order.releasedAt)}</dd>
          </>
        )}
        {MILESTONES.map(([key, label]) => {
          const value = order[key];
          return value ? (
            <Fragment key={key}>
              <dt className="text-ink-secondary">{label}</dt>
              <dd className="text-ink-primary tabular-nums">{formatDateTime(value)}</dd>
            </Fragment>
          ) : null;
        })}
        {order.deliveryFailureReason && (
          <>
            <dt className="text-ink-secondary">Giao thất bại</dt>
            <dd className="text-ink-primary">
              {order.deliveryFailureReason === "UNKNOWN"
                ? "Không rõ"
                : ORDER_DELIVERY_FAILURE_LABELS[order.deliveryFailureReason]}
            </dd>
          </>
        )}
      </dl>
    </section>
  );
}
