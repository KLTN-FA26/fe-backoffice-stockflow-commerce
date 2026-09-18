import { formatMoney } from "@/lib/format";

import type { Order } from "../types";

function Row({
  label,
  value,
  bold,
  valueClass,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className={bold ? "text-ink-primary font-bold" : "text-ink-secondary"}>{label}</span>
      <span
        className={
          bold
            ? `text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold tabular-nums ${valueClass ?? ""}`
            : `font-[family-name:var(--font-mono)] tabular-nums ${valueClass ?? ""}`
        }
      >
        {value}
      </span>
    </div>
  );
}

interface OrderFinanceCardProps {
  order: Order;
}

export function OrderFinanceCard({ order }: OrderFinanceCardProps) {
  return (
    <>
      <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
        <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tài chính</h2>
        <div className="flex flex-col gap-2 text-[0.875rem]">
          <Row label="Tạm tính" value={formatMoney(order.subtotal)} />
          <Row label="Phí vận chuyển" value={formatMoney(order.shippingFee)} />
          <Row label="Thuế VAT" value={formatMoney(order.taxTotal)} />
          {order.discountTotal > 0 && (
            <Row
              label="Giảm giá"
              value={`−${formatMoney(order.discountTotal)}`}
              valueClass="text-positive"
            />
          )}
          <div className="border-border-default border-t pt-2.5">
            <Row label="Tổng thanh toán" value={formatMoney(order.grandTotal)} bold />
          </div>
        </div>
      </section>

      {order.notes && (
        <section className="border-border-default bg-bg-subtle text-ink-secondary rounded-[var(--r-sm)] border p-3 text-xs">
          <strong className="text-ink-primary">Ghi chú:</strong> {order.notes}
        </section>
      )}
    </>
  );
}
