"use client";

import { CANCELLATION_REQUEST_LABELS } from "@/constants";
import { formatMoney } from "@/lib/format";

import { useOrderRefund } from "../../queries";

import type { OrderRefundDto, OrderSettlement } from "../../cancellation-request-schemas";

const L = CANCELLATION_REQUEST_LABELS.settlement;

/** BE `OrderSettlement.Kind.ORDER_CANCELLED` — tất toán của lần huỷ đơn (khác đóng phần còn lại / trả hàng). */
const CANCELLED_KIND = "ORDER_CANCELLED";

/** Tất toán của lần huỷ gần nhất (BE trả theo thứ tự thời gian) — `undefined` khi chưa có. Pure — export để test. */
export function cancellationSettlementOf(refund: OrderRefundDto): OrderSettlement | undefined {
  return [...(refund.settlements ?? [])].reverse().find((s) => s.kind === CANCELLED_KIND);
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-secondary">{label}</dt>
      <dd
        className={`font-[family-name:var(--font-mono)] tabular-nums ${strong ? "text-ink-primary font-medium" : "text-ink-primary"}`}
      >
        {value}
      </dd>
    </div>
  );
}

/**
 * Kết quả tất toán tiền sau khi duyệt huỷ — số BE tính (docs 15 §4.5–4.6, 17 §4.8 bước 30): tiền đã thu trả phí trước,
 * phần thừa là tiền phải hoàn, phần phí thiếu thành khoản phí huỷ. FE không tự tính lại. Chỉ gọi khi `enabled` (đơn đã
 * huỷ + `payment-refunds:READ`); lỗi tải không chặn màn đơn, chỉ báo ở panel.
 */
export function CancellationSettlementPanel({
  orderId,
  currency,
  enabled,
}: {
  orderId: string;
  currency: string;
  enabled: boolean;
}) {
  const query = useOrderRefund(orderId, { enabled });
  if (!enabled) return null;
  const settlement = query.data ? cancellationSettlementOf(query.data) : undefined;
  const money = (amount: number | null | undefined) => formatMoney(amount ?? 0, currency);
  return (
    <div className="border-border-default bg-bg-subtle mt-3 space-y-2 rounded-[var(--r-sm)] border p-3 text-[0.8125rem]">
      <h3 className="text-ink-primary font-semibold">{L.title}</h3>
      {query.isPending ? (
        <p className="text-ink-tertiary text-xs">{L.loading}</p>
      ) : query.isError ? (
        <p className="text-ink-tertiary text-xs">{L.failed}</p>
      ) : !settlement ? (
        <p className="text-ink-tertiary text-xs">{L.none}</p>
      ) : (
        <>
          <dl className="space-y-1">
            <Row label={L.collected} value={money(settlement.collected)} />
            <Row
              label={`${L.fee}${settlement.feePercent ? ` ${L.feePercent(String(settlement.feePercent))}` : ""}`}
              value={money(settlement.fee)}
            />
            <Row label={L.feeCovered} value={money(settlement.feeCovered)} />
            <Row label={L.refundable} value={money(settlement.refundable)} strong />
            <Row label={L.feeOwed} value={money(settlement.feeOwed)} strong />
          </dl>
          {settlement.feeReason && (
            <p className="text-ink-secondary break-words">
              <span className="text-ink-tertiary">{L.feeReason}: </span>
              {settlement.feeReason}
            </p>
          )}
          {settlement.feeDetail && (
            <p className="text-ink-secondary break-words">
              <span className="text-ink-tertiary">{L.feeDetail}: </span>
              {settlement.feeDetail}
            </p>
          )}
          <p className="text-ink-tertiary text-xs">{L.accountantNote}</p>
        </>
      )}
    </div>
  );
}
