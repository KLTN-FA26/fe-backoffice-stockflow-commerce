import { formatDate, formatDateTime } from "@/lib/format/date";
import { useWarehouseOptions } from "@/lib/references/warehouse-options";

import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
}

const EMPTY = "—";

/**
 * Kho xuất đã chọn khi release (SCRUM-423). Tên kho tra qua `GET /warehouses` — ORDER_COORDINATOR
 * chưa được cấp `warehouse-warehouses:READ` (BE seed) nên có thể 403 → hiện mã kho thay vì lỗi.
 */
function WarehouseName({ warehouseId }: { warehouseId: string }) {
  const { data } = useWarehouseOptions();
  const warehouse = data?.find((w) => w.warehouseId === warehouseId);
  return warehouse ? (
    <span>{warehouse.name}</span>
  ) : (
    <span className="font-[family-name:var(--font-mono)] text-xs" title={warehouseId}>
      {warehouseId}
    </span>
  );
}

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
      </dl>
    </section>
  );
}
