import type { Order } from "../types";

interface OrderInfoCardProps {
  order: Order;
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
        <dt className="text-ink-secondary">Ngày đặt</dt>
        <dd className="text-ink-primary tabular-nums">
          {new Date(order.placedAt).toLocaleDateString("vi-VN")}
        </dd>
        <dt className="text-ink-secondary">Thanh toán</dt>
        <dd className="text-ink-primary">{order.paymentMethodType}</dd>
        <dt className="text-ink-secondary">Kho xử lý</dt>
        <dd className="text-ink-primary font-mono">{order.fulfillmentWarehouseId}</dd>
        <dt className="text-ink-secondary">Địa chỉ giao</dt>
        <dd className="text-ink-primary">
          {order.shippingAddress.street}, {order.shippingAddress.ward},{" "}
          {order.shippingAddress.district}, {order.shippingAddress.province}
        </dd>
        <dt className="text-ink-secondary">Người nhận</dt>
        <dd className="text-ink-primary">
          {order.recipientName} · {order.recipientPhone}
        </dd>
      </dl>
    </section>
  );
}
