"use client";

import { ADMIN_ROUTES } from "@/constants";
import { PAYMENT_LABELS, SETTLEMENT_KIND_LABELS } from "@/constants/labels-payment";
import { PAYMENT_ROUTES } from "@/constants/payment";
import { SHIPMENT_PERMISSIONS } from "@/constants/permissions";
import { useCan } from "@/lib/auth/components/Can";
import { formatDateTime } from "@/lib/format/date";

import { CodeLink, InfoRow, MoneyCell } from "./primitives";

import type { OrderRefund } from "../types";

const L = PAYMENT_LABELS.refunds;

/**
 * Các lần tính hoàn của đơn (huỷ đơn / đóng phần còn lại / trả hàng / lô hãng hoàn về — docs 15 §4.5, §4.6; WF-05 F-9):
 * lần tính SHIPMENT_RETURNED nêu lô giao (`shipmentId`, mở được khi có quyền xem lô) và phần phí vận chuyển được miễn
 * (Q-19: theo tỷ lệ giá trị hàng của lô, toàn bộ phần còn lại khi đơn không giao được gì).
 */
export function RefundSettlements({ refund }: { refund: OrderRefund }) {
  const canOpenShipment = useCan(SHIPMENT_PERMISSIONS.read);
  return (
    <div className="space-y-4">
      {(refund.settlements ?? []).map((s) => (
        <div
          key={s.settlementId}
          className="border-border-default space-y-2 rounded-[var(--r-sm)] border p-3"
        >
          <div className="text-ink-primary flex flex-wrap items-center justify-between gap-2 text-[0.8125rem] font-semibold">
            <span>{SETTLEMENT_KIND_LABELS[s.kind]}</span>
            <span className="text-ink-tertiary font-normal">
              {L.settledAt}: {formatDateTime(s.settledAt)}
            </span>
          </div>
          <dl className="grid grid-cols-[minmax(180px,auto)_1fr] gap-x-4 gap-y-1.5 text-[0.8125rem]">
            {s.shipmentId && canOpenShipment && (
              <InfoRow label={L.shipment}>
                <CodeLink href={ADMIN_ROUTES.shipments.detail(s.shipmentId)}>
                  {L.openShipment}
                </CodeLink>
              </InfoRow>
            )}
            <InfoRow label={L.collected}>
              <MoneyCell amount={s.collected} currency={refund.currency} />
            </InfoRow>
            {s.closed > 0 && (
              <InfoRow label={L.closed}>
                <MoneyCell amount={s.closed} currency={refund.currency} />
              </InfoRow>
            )}
            {s.reduced > 0 && (
              <InfoRow label={L.reduced}>
                <MoneyCell amount={s.reduced} currency={refund.currency} />
              </InfoRow>
            )}
            {s.shippingFeeWaived != null && s.shippingFeeWaived > 0 && (
              <InfoRow label={L.shippingFeeWaived}>
                <MoneyCell amount={s.shippingFeeWaived} currency={refund.currency} />
                <p className="text-ink-tertiary text-xs">{L.shippingFeeWaivedHint}</p>
              </InfoRow>
            )}
            <InfoRow label={L.surplus}>
              <MoneyCell amount={s.surplus} currency={refund.currency} />
            </InfoRow>
            <InfoRow label={L.fee}>
              <MoneyCell amount={s.fee} currency={refund.currency} />
              {s.feePercent != null && (
                <span className="text-ink-tertiary"> ({s.feePercent}%)</span>
              )}
            </InfoRow>
            {s.feeReason && (
              <InfoRow label={L.feeReason}>
                {s.feeReason}
                {s.feeDetail ? ` — ${s.feeDetail}` : ""}
              </InfoRow>
            )}
            <InfoRow label={L.feeCovered}>
              <MoneyCell amount={s.feeCovered} currency={refund.currency} />
            </InfoRow>
            <InfoRow label={L.refundable}>
              <MoneyCell amount={s.refundable} currency={refund.currency} />
            </InfoRow>
            {s.feeOwed > 0 && (
              <InfoRow label={L.feeOwed}>
                <MoneyCell amount={s.feeOwed} currency={refund.currency} />
                {s.feeItemId && (
                  <span className="ml-3">
                    <CodeLink href={PAYMENT_ROUTES.installments.detail(s.feeItemId)}>
                      {L.feeItem}
                    </CodeLink>
                  </span>
                )}
              </InfoRow>
            )}
          </dl>
        </div>
      ))}
    </div>
  );
}
