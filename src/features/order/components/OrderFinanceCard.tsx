import { FEE_BEARER_LABELS, ORDER_FINANCE_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";

import { cancellationReasonLabel, parseCancellationReason } from "../selectors";

import { OrderInstallmentsSummary } from "./OrderInstallmentsSummary";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";
import type { Order } from "../types";

interface OrderFinanceCardProps {
  order: Order;
  can: (code: PermissionCode) => boolean;
}

const EMPTY = "—";
const L = ORDER_FINANCE_LABELS;

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="text-ink-primary text-right">{children}</dd>
    </>
  );
}

function Money({ value, currency }: { value: number; currency: string }) {
  return <span className="font-mono tabular-nums">{formatMoney(value, currency)}</span>;
}

function feeLabel(fee: Order["fees"][number]): string {
  const label = L.feeKinds[fee.kind];
  return fee.sku ? L.feeOfSku(label, fee.sku) : label;
}

/**
 * Thanh toán + tài chính của đơn — chỉ những số BE `OrderResponse` có (4B-3): tổng, tạm tính trước thuế, dòng phí (phí
 * khuôn / phí vận chuyển), VAT, giá trị sau khi đóng phần còn lại. Tiến độ thu tiền (đã thu / còn phải thu / phải thu
 * trước khi xuất) đọc từ các đợt của hợp đồng (`OrderInstallmentsSummary`) — `OrderResponse` không còn mang phương thức,
 * cọc hay công nợ. Số BE vắng (null) không hiện, KHÔNG thành 0; không tự tính số tiền nào.
 */
export function OrderFinanceCard({ order, can }: OrderFinanceCardProps) {
  const { cancellation, currency } = order;
  const cancellationNote = cancellation
    ? parseCancellationReason(cancellation.reason, cancellation.reasonCode).note
    : null;
  const closedOut = order.effectiveTotal !== null && order.effectiveTotal !== order.totalAmount;

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 text-[0.9375rem] font-semibold">{L.title}</h2>
      <div className="mb-3 flex items-baseline justify-between text-[0.875rem]">
        <span className="text-ink-primary font-bold">{L.total}</span>
        <span className="text-ink-primary font-[family-name:var(--font-display)] text-[1.25rem] font-bold tabular-nums">
          {formatMoney(order.totalAmount, currency)}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[0.8125rem]">
        {order.netAmount !== null && (
          <Row label={L.net}>
            <Money value={order.netAmount} currency={currency} />
          </Row>
        )}
        {order.fees.map((fee, index) => (
          <Row key={`${fee.kind}-${fee.sku ?? index}`} label={feeLabel(fee)}>
            <Money value={fee.amount} currency={currency} />
          </Row>
        ))}
        {order.taxAmount !== null && (
          <Row label={L.tax}>
            <Money value={order.taxAmount} currency={currency} />
          </Row>
        )}
        {closedOut && order.effectiveTotal !== null && (
          <Row label={L.effectiveTotal}>
            <Money value={order.effectiveTotal} currency={currency} />
          </Row>
        )}
        <OrderInstallmentsSummary
          orderId={order.orderId}
          can={can}
          cancelled={order.status === "Cancelled"}
        />
        {cancellation && (
          <>
            <Row label="Lý do huỷ">
              {cancellation.reasonCode ? cancellationReasonLabel(cancellation.reasonCode) : EMPTY}
            </Row>
            {/* `reason` của BE là "CODE: ghi chú" — chỉ hiện phần ghi chú */}
            {cancellationNote && <Row label="Ghi chú huỷ">{cancellationNote}</Row>}
            {cancellation.retainedAmount !== null && (
              <Row label="Giữ lại từ tiền đã thu">
                <Money value={cancellation.retainedAmount} currency={currency} />
              </Row>
            )}
            {/* Khoản thoả thuận (decision Q2): tiền đã thu trả trước, phần vượt thành công nợ —
                khác "giữ lại", không cộng hai số với nhau */}
            {cancellation.feeAmount !== null && (
              <Row label="Phí thoả thuận">
                <Money value={cancellation.feeAmount} currency={currency} />
              </Row>
            )}
            {(cancellation.feeBearer === "COMPANY" || cancellation.feeBearer === "CUSTOMER") && (
              <Row label={FEE_BEARER_LABELS.legend}>
                {FEE_BEARER_LABELS.options[cancellation.feeBearer]}
              </Row>
            )}
            {cancellation.feeReason && <Row label="Lý do giữ phí">{cancellation.feeReason}</Row>}
            {cancellation.feeDetail && (
              <Row label="Nội dung thoả thuận">{cancellation.feeDetail}</Row>
            )}
          </>
        )}
      </dl>
    </section>
  );
}
