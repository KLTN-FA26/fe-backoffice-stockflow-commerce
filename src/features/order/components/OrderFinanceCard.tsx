import { ORDER_PAYMENT_STATUS_DISPLAY, ORDER_PAYMENT_TERM_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";
import { StatusDot } from "@/components/shared/StatusDot";

import { cancellationReasonLabel, parseCancellationReason } from "../selectors";

import { CreditValue, DepositValue } from "./PaymentStateValues";

import type { ReactNode } from "react";
import type { Order } from "../types";

interface OrderFinanceCardProps {
  order: Order;
}

const EMPTY = "—";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary text-right">{children}</dd>
    </>
  );
}

/**
 * Thanh toán của đơn. BE `OrderResponse` không có tạm tính / phí ship / thuế / giảm giá — không
 * tự tính các dòng đó. Trạng thái cọc / công nợ suy từ field BE (selectors), không có enum riêng.
 */
export function OrderFinanceCard({ order }: OrderFinanceCardProps) {
  const { cancellation } = order;
  const cancellationNote = cancellation
    ? parseCancellationReason(cancellation.reason, cancellation.reasonCode).note
    : null;
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">Thanh toán</h2>
      <div className="mb-3 flex items-baseline justify-between text-[0.875rem]">
        <span className="text-ink-primary font-bold">Tổng thanh toán</span>
        <span className="text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold tabular-nums">
          {formatMoney(order.totalAmount, order.currency)}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
        <Row label="Phương thức">
          {order.paymentTerm ? ORDER_PAYMENT_TERM_LABELS[order.paymentTerm] : EMPTY}
        </Row>
        <Row label="Trạng thái">
          {order.paymentStatus ? (
            <StatusDot
              domain="payment"
              status={ORDER_PAYMENT_STATUS_DISPLAY[order.paymentStatus]}
            />
          ) : (
            EMPTY
          )}
        </Row>
        <Row label="Đã thu">
          <span className="font-mono tabular-nums">
            {order.paidAmount !== null ? formatMoney(order.paidAmount, order.currency) : EMPTY}
          </span>
        </Row>
        {order.paymentTerm === "DEPOSIT" && (
          <Row label="Tiền cọc">
            <DepositValue order={order} />
          </Row>
        )}
        {order.paymentTerm === "CREDIT" && (
          <Row label="Công nợ">
            <CreditValue order={order} />
          </Row>
        )}
        {cancellation && (
          <>
            <Row label="Lý do huỷ">
              {cancellation.reasonCode ? cancellationReasonLabel(cancellation.reasonCode) : EMPTY}
            </Row>
            {/* `reason` của BE là "CODE: ghi chú" — chỉ hiện phần ghi chú */}
            {cancellationNote && <Row label="Ghi chú huỷ">{cancellationNote}</Row>}
            {cancellation.retainedAmount !== null && (
              <Row label="Giữ lại">
                <span className="font-mono tabular-nums">
                  {formatMoney(cancellation.retainedAmount, order.currency)}
                </span>
              </Row>
            )}
          </>
        )}
      </dl>
    </section>
  );
}
