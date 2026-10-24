import { Fragment } from "react";

import { ORDER_DELIVERY_FAILURE_LABELS, WAREHOUSE_PERMISSIONS } from "@/constants";
import { usePermissionChecker } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format/date";
import { useWarehouseDirectory } from "@/lib/references/warehouse-options";

import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
}

const EMPTY = "—";

/**
 * Kho xuất đã chọn khi release (SCRUM-423). Tên kho tra qua danh mục `GET /warehouses` (mọi trạng
 * thái — kho có thể đã ngừng hoạt động sau khi release), chỉ khi có `warehouse-warehouses:READ`:
 * thiếu quyền (vd ORDER_COORDINATOR trước BE V20261022000100) thì không gọi API, báo không xem được tên.
 * UI-only — Backend phải re-check (WarehouseController @RequiresPermission warehouse-warehouses:READ).
 */
function WarehouseName({ warehouseId }: { warehouseId: string }) {
  const can = usePermissionChecker();
  const canRead = can(WAREHOUSE_PERMISSIONS.read);
  const { data } = useWarehouseDirectory(canRead);
  const warehouse = data?.find((w) => w.warehouseId === warehouseId);
  if (warehouse) return <span>{warehouse.name}</span>;
  if (!canRead) {
    return (
      <span className="text-ink-secondary" title={warehouseId}>
        Đã chọn kho — tài khoản chưa có quyền xem tên kho
      </span>
    );
  }
  return (
    <span className="font-[family-name:var(--font-mono)] text-xs" title={warehouseId}>
      {warehouseId}
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

export function OrderInfoCard({ order }: OrderInfoCardProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Thông tin</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
        <dt className="text-ink-secondary">Mã đơn</dt>
        <dd className="text-ink-primary font-[family-name:var(--font-mono)] font-medium">
          {order.orderNumber}
        </dd>
        <dt className="text-ink-secondary">Mã khách</dt>
        <dd className="text-ink-primary truncate font-[family-name:var(--font-mono)] text-xs">
          {order.customerId ?? EMPTY}
        </dd>
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
        <dd className="text-ink-primary">{order.shippingAddressText ?? EMPTY}</dd>
        <dt className="text-ink-secondary">Kho xuất</dt>
        <dd className="text-ink-primary">
          {order.warehouseId ? <WarehouseName warehouseId={order.warehouseId} /> : "Chưa release"}
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
