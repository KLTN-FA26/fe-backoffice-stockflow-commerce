import { formatMoney } from "@/lib/format";

import type { Order } from "../types";

interface OrderFinanceCardProps {
  order: Order;
}

/**
 * BE `OrderResponse` chỉ trả `totalAmount` + `currency` — không có tạm tính, phí ship,
 * thuế, giảm giá. Không tự tính/bịa các dòng đó.
 */
export function OrderFinanceCard({ order }: OrderFinanceCardProps) {
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tài chính</h2>
      <div className="flex items-baseline justify-between text-[0.875rem]">
        <span className="text-ink-primary font-bold">Tổng thanh toán</span>
        <span className="text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold tabular-nums">
          {formatMoney(order.totalAmount, order.currency)}
        </span>
      </div>
    </section>
  );
}
