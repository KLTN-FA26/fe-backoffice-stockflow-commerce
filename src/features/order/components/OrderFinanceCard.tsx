import {
  ORDER_BALANCE_POLICY_LABELS,
  ORDER_PAYMENT_STATUS_DISPLAY,
  ORDER_PAYMENT_TERM_LABELS,
} from "@/constants";
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

/** Đơn không còn khoản phải thu: nháp, đã huỷ, đã đóng sổ — BE vẫn tính `amountDue` từ tổng đơn. */
/** "Thu phần còn lại" của đơn cọc: nhãn Việt của `balancePolicy` (BE PR #150: có thêm ON_CREDIT). */
function balancePolicyLabel(policy: NonNullable<Order["balancePolicy"]>): string {
  return policy === "UNKNOWN" ? "Không rõ" : ORDER_BALANCE_POLICY_LABELS[policy];
}

const NO_RECEIVABLE_STATUSES: readonly Order["status"][] = ["Draft", "Cancelled", "Closed"];

/**
 * Thanh toán + tài chính của đơn. BE `OrderResponse` không có tạm tính / phí ship / thuế / giảm giá —
 * không tự tính các dòng đó. Trạng thái cọc / công nợ suy từ field BE (selectors), không có enum riêng.
 * Số tiền BE vắng (null) hiện "—", KHÔNG thành 0; không cộng các số khác nghĩa với nhau.
 * Số tiền vòng đời (BE PR #133) chỉ hiện khi có nghĩa:
 * - `effectiveTotal` khi khác tổng gốc (đã đóng phần còn lại).
 * - `billedAmount` (bắt đầu từ 0) chỉ với đơn công nợ (CREDIT) hoặc khi đã > 0.
 * - `amountDue` / `amountDueBeforeHandover` ẩn với đơn nháp / đã huỷ / đã đóng sổ (huỷ chưa thanh
 *   toán không "còn nợ" cả tổng đơn); phải-trả-trước-khi-xuất chỉ hiện khi > 0.
 * - `amountDueOnDelivery` (hãng thu khi giao, đơn cọc ON_DELIVERY) chỉ hiện khi > 0.
 */
export function OrderFinanceCard({ order }: OrderFinanceCardProps) {
  const { cancellation } = order;
  const cancellationNote = cancellation
    ? parseCancellationReason(cancellation.reason, cancellation.reasonCode).note
    : null;
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
    if (order.amountDueOnDelivery !== null && order.amountDueOnDelivery > 0) {
      rows.push({ label: "Hãng vận chuyển thu khi giao", value: order.amountDueOnDelivery });
    }
  }

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
        {order.balancePolicy && (
          <Row label="Thu phần còn lại">{balancePolicyLabel(order.balancePolicy)}</Row>
        )}
        {/* Đơn cọc ON_CREDIT: phần còn lại thành công nợ (BE PR #150); đơn CREDIT hiện kỳ hạn ở "Công nợ" */}
        {order.paymentTerm === "DEPOSIT" && order.creditTermDays !== null && (
          <Row label="Hạn công nợ">
            <span className="tabular-nums">{order.creditTermDays} ngày sau khi giao</span>
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
              <Row label="Giữ lại từ tiền đã thu">
                <span className="font-mono tabular-nums">
                  {formatMoney(cancellation.retainedAmount, order.currency)}
                </span>
              </Row>
            )}
            {/* Khoản thoả thuận (decision Q2): tiền đã thu trả trước, phần vượt thành công nợ —
                khác "giữ lại", không cộng hai số với nhau */}
            {cancellation.feeAmount !== null && (
              <Row label="Phí thoả thuận">
                <span className="font-mono tabular-nums">
                  {formatMoney(cancellation.feeAmount, order.currency)}
                </span>
              </Row>
            )}
            {cancellation.feeReason && <Row label="Lý do giữ phí">{cancellation.feeReason}</Row>}
            {cancellation.feeDetail && (
              <Row label="Nội dung thoả thuận">{cancellation.feeDetail}</Row>
            )}
          </>
        )}
      </dl>
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
