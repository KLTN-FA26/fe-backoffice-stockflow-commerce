import { formatMoney } from "@/lib/format";

import type { Order } from "../types";

interface OrderFinanceCardProps {
  order: Order;
}

/** Đơn không còn khoản phải thu: nháp, đã huỷ, đã đóng sổ — BE vẫn tính `amountDue` từ tổng đơn. */
const NO_RECEIVABLE_STATUSES: readonly Order["status"][] = ["Draft", "Cancelled", "Closed"];

/**
 * Tài chính đơn. BE trả `totalAmount` + (PR #133) `effectiveTotal`, `billedAmount`, `amountDue`,
 * `amountDueBeforeHandover` — không có tạm tính, phí ship, thuế, giảm giá nên không tự tính/bịa.
 * BE luôn gửi các số này nên chỉ hiện khi có nghĩa:
 * - `effectiveTotal` khi khác tổng gốc (đã đóng phần còn lại).
 * - `billedAmount` (bắt đầu từ 0) chỉ với đơn công nợ (CREDIT) hoặc khi đã > 0.
 * - `amountDue` / `amountDueBeforeHandover` ẩn với đơn nháp / đã huỷ / đã đóng sổ (huỷ chưa thanh
 *   toán không "còn nợ" cả tổng đơn); phải-trả-trước-khi-xuất chỉ hiện khi > 0.
 */
export function OrderFinanceCard({ order }: OrderFinanceCardProps) {
  const rows: { label: string; value: number }[] = [];
  if (order.effectiveTotal !== null && order.effectiveTotal !== order.totalAmount) {
    rows.push({ label: "Giá trị sau khi đóng phần còn lại", value: order.effectiveTotal });
  }
  if (order.billedAmount !== null && (order.paymentTerm === "CREDIT" || order.billedAmount > 0)) {
    rows.push({ label: "Đã ghi công nợ", value: order.billedAmount });
  }
  if (!NO_RECEIVABLE_STATUSES.includes(order.status)) {
    if (order.amountDue !== null) rows.push({ label: "Khách còn nợ", value: order.amountDue });
    if (order.amountDueBeforeHandover !== null && order.amountDueBeforeHandover > 0) {
      rows.push({ label: "Phải trả trước khi xuất hàng", value: order.amountDueBeforeHandover });
    }
  }

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Tài chính</h2>
      <div className="flex items-baseline justify-between text-[0.875rem]">
        <span className="text-ink-primary font-bold">Tổng thanh toán</span>
        <span className="text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold tabular-nums">
          {formatMoney(order.totalAmount, order.currency)}
        </span>
      </div>
      {rows.length > 0 && (
        <dl className="border-border-default mt-3 space-y-1.5 border-t pt-3 text-[0.8125rem]">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-secondary">{row.label}</dt>
              <dd className="text-ink-primary font-mono tabular-nums">
                {formatMoney(row.value, order.currency)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
