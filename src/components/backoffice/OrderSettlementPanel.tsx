"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Info } from "lucide-react";

import { SETTLEMENT_READINESS_LABELS } from "@/constants";
import {
  EINVOICE_PERMISSIONS,
  EINVOICE_ROUTES,
  EINVOICE_STATUS_BY_API,
} from "@/constants/einvoice";
import {
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_REFUND_PERMISSIONS,
  PAYMENT_ROUTES,
} from "@/constants/payment";
import { ApiError } from "@/lib/api/error";
import { useCan } from "@/lib/auth/components/Can";
import { closingDate, completionChecks } from "@/lib/domain/order-completion";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { DrawUpDialog, useEInvoices, invoiceReference } from "@/features/einvoice";
import { useOrderInstallments, useOrderRefund } from "@/features/payment";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import type { ReactNode } from "react";
import type { CompletionCheck } from "@/lib/domain/order-completion";
import type { OrderSettlementSlotProps } from "@/features/order";

const MONO = "font-mono tabular-nums";
const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1";
const R = SETTLEMENT_READINESS_LABELS;

type Readiness = NonNullable<OrderSettlementSlotProps["settlementReadiness"]>;

/** Ngày giờ VN từ instant của BE; chuỗi không parse được hiện nguyên văn (không làm hỏng bảng). */
const dayOf = (iso: string) => (Number.isNaN(Date.parse(iso)) ? iso : formatDate(iso));

/** Đơn KHÔNG có lịch thanh toán: BE trả 404 cho `GET /installments/orders/{id}` — BE coi là không nợ (C-7). */
const isNoPlan = (error: unknown) => error instanceof ApiError && error.status === 404;

type RefundView = NonNullable<ReturnType<typeof useOrderRefund>["data"]>;

/** Phí vận chuyển được miễn trên mọi khoản quyết toán của đơn (Q-19); âm / vắng tính 0. */
const waivedOf = (refund: RefundView) =>
  (refund.settlements ?? []).reduce(
    (sum, settlement) => sum + Math.max(settlement.shippingFeeWaived ?? 0, 0),
    0,
  );

/**
 * Hàng "Hoàn tiền" có gì để xem: tiền phải hoàn, phí vận chuyển được miễn (Q-19) hoặc phí khách còn thiếu (`feeOwed`) — như
 * thẻ Hoàn tiền của cổng khách (SF money M-4). Khách trả sau chưa trả đồng nào mà lô bị hoàn: `refundable` = 0 nhưng vẫn
 * được miễn phí vận chuyển, Sale / Kế toán phải thấy điều đó (audit r2 money M-4, BO).
 */
function hasRefundRow(refund: RefundView): boolean {
  return refund.refundable > 0 || (refund.feeOwed ?? 0) > 0 || waivedOf(refund) > 0;
}

/** Lần giao có hoá đơn gốc / thay thế đã phát hành (docs 21 BR-01). */
const invoicedShipments = (
  rows: readonly { status: string; type: string; shipmentId?: string | null }[],
) =>
  rows
    .filter((row) => row.status === "ISSUED" && row.type !== "ADJUSTMENT" && row.shipmentId)
    .map((row) => row.shipmentId as string);

/**
 * Thanh toán, hoá đơn & hoàn tất của một đơn (WF-05 BO-10): các đợt của hợp đồng (docs 15 §5.2), hoá
 * đơn điện tử theo lần giao (docs 21), hoàn tiền (docs 15 §4.5) và điều kiện tự hoàn tất / tự đóng. Điều kiện lấy từ
 * khối BE tính (`settlementReadiness`, WF-05 BO-02 / F-1); chỉ khi BE chưa trả khối mới dùng ước tính dự phòng
 * (`lib/domain/order-completion`, ghi rõ là ước tính). Mỗi phần chỉ hiện khi có quyền.
 */
export function OrderSettlementPanel(props: OrderSettlementSlotProps) {
  const canInstallments = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const canInvoices = useCan(EINVOICE_PERMISSIONS.read);
  const canRefunds = useCan(PAYMENT_REFUND_PERMISSIONS.read);
  const installments = useOrderInstallments(props.orderId, canInstallments);
  const invoices = useEInvoices(
    { orderId: props.orderId, page: 0, size: 50 },
    { enabled: canInvoices },
  );
  const refund = useOrderRefund(canRefunds ? props.orderId : null);
  if (!canInstallments && !canInvoices && !canRefunds) return null;

  const plan = installments.data;
  const rows = invoices.data?.items ?? [];
  const readiness = props.settlementReadiness;
  // Dự phòng (BE chưa trả khối điều kiện): chỉ cho đơn đã giao, và chỉ khi KHÔNG có khối của BE (invariant G5)
  const checks =
    !readiness && (props.status === "Delivered" || props.status === "Return Requested")
      ? completionChecks({
          status: props.status,
          deliveredAt: props.deliveredAt,
          completedAt: props.completedAt,
          outstanding: plan ? plan.outstanding : isNoPlan(installments.error) ? 0 : null,
          returnWindowDays: props.returnWindowDays,
          deliveredShipmentIds: props.deliveredShipmentIds,
          invoicedShipmentIds: invoicedShipments(rows),
          completionHeld: props.completionHeld,
        })
      : [];

  return (
    <Card className="space-y-4 text-[0.8125rem]">
      <h2 className="text-ink-primary text-sm font-semibold">Thanh toán, hoá đơn & hoàn tất</h2>

      {canInstallments && (
        <section aria-label="Đợt thanh toán" className="space-y-1">
          <div className={ROW}>
            <h3 className="text-ink-primary font-semibold">Đợt thanh toán</h3>
            <Link
              className="text-accent-text hover:underline"
              href={PAYMENT_ROUTES.installments.ofOrder(props.orderId)}
            >
              Xem các đợt
            </Link>
          </div>
          {plan ? (
            <p className="text-ink-secondary">
              Hợp đồng <span className={MONO}>{plan.contractNumber}</span> · đã thu{" "}
              <span className={MONO}>{formatMoney(plan.paid, plan.currency)}</span> /{" "}
              <span className={MONO}>{formatMoney(plan.total, plan.currency)}</span> · còn{" "}
              <span className={MONO}>{formatMoney(plan.outstanding, plan.currency)}</span>
            </p>
          ) : (
            <p className="text-ink-tertiary">
              {installments.isPending
                ? "Đang tải…"
                : installments.isError && !isNoPlan(installments.error)
                  ? "Không tải được các đợt thanh toán."
                  : "Đơn chưa có đợt thanh toán (hợp đồng chưa ký)."}
            </p>
          )}
        </section>
      )}

      {canInvoices && (
        <section aria-label="Hoá đơn điện tử" className="space-y-1">
          <div className={ROW}>
            <h3 className="text-ink-primary font-semibold">Hoá đơn điện tử</h3>
            <Link
              className="text-accent-text hover:underline"
              href={EINVOICE_ROUTES.ofOrder(props.orderId)}
            >
              Xem / lập hoá đơn
            </Link>
          </div>
          {rows.length === 0 ? (
            <p className="text-ink-tertiary">
              {invoices.isPending
                ? "Đang tải…"
                : "Chưa có hoá đơn — nháp được tạo khi một lần giao thành công."}
            </p>
          ) : (
            <ul className="divide-y divide-[var(--table-line)]">
              {rows.map((row) => (
                <li key={row.id} className={`${ROW} py-1`}>
                  <Link
                    className={`text-accent-text hover:underline ${MONO}`}
                    href={EINVOICE_ROUTES.detail(row.id)}
                  >
                    {invoiceReference(row)}
                  </Link>
                  <span className="text-ink-secondary font-mono">
                    {row.shipmentCode ?? "Phí vận chuyển"}
                  </span>
                  <span className={MONO}>{formatMoney(row.grandTotal, "VND")}</span>
                  <StatusDot domain="invoice" status={EINVOICE_STATUS_BY_API[row.status]} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canRefunds && refund.data && hasRefundRow(refund.data) && (
        <RefundRow refund={refund.data} orderId={props.orderId} />
      )}
      {canRefunds &&
        refund.data &&
        props.status === "Partially Refunded" &&
        refund.data.refunded === 0 && (
          // Audit r2 M-6 (BE-45): đơn ghi "Hoàn tiền một phần" mà chưa hoàn đồng nào (dữ liệu trước bản sửa — BE nay đóng
          // thẳng đơn không có gì phải hoàn) — nói rõ, không để người xem tưởng khách đã nhận tiền
          <p className="text-ink-secondary flex gap-1.5">
            <Info className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {R.noRefundDespiteStatus}
          </p>
        )}

      {readiness ? (
        <ReadinessSection readiness={readiness} status={props.status} orderId={props.orderId} />
      ) : (
        <>
          {checks.length > 0 && <FallbackChecks checks={checks} />}
          {props.status === "Completed" && props.completedAt && (
            <p className="text-ink-secondary">
              Đơn đã hoàn tất; tự đóng ngày{" "}
              {formatDate(closingDate(props.completedAt).toISOString())} nếu không còn nợ.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

/** Hàng "Hoàn tiền": có tiền phải hoàn → đã hoàn / còn; không có → phí được miễn / phí còn thiếu (Q-19). */
function RefundRow({ refund, orderId }: { refund: RefundView; orderId: string }) {
  const money = (amount: number) => (
    <span className={MONO}>{formatMoney(amount, refund.currency)}</span>
  );
  const waived = waivedOf(refund);
  const owed = refund.feeOwed ?? 0;
  return (
    <section aria-label="Hoàn tiền" className={ROW}>
      <h3 className="text-ink-primary font-semibold">Hoàn tiền</h3>
      <span className="text-ink-secondary">
        {refund.refundable > 0 ? (
          <>
            Đã hoàn {money(refund.refunded)} · còn {money(refund.remaining)}
          </>
        ) : (
          R.nothingToRefund
        )}
        {waived > 0 && <> · phí vận chuyển được miễn {money(waived)}</>}
        {owed > 0 && <> · phí khách còn thiếu {money(owed)}</>}
      </span>
      <Link
        className="text-accent-text hover:underline"
        href={PAYMENT_ROUTES.refunds.ofOrder(orderId)}
      >
        Xem
      </Link>
    </section>
  );
}

function CheckRow({ met, children }: { met: boolean; children: ReactNode }) {
  return (
    <li data-met={met} className="flex gap-2">
      {met ? (
        <CheckCircle2 aria-label={R.met} className="text-dot-positive mt-0.5 size-3.5 shrink-0" />
      ) : (
        <Circle aria-label={R.unmet} className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}

/** Ước tính dự phòng khi BE chưa trả khối điều kiện — ghi rõ là ước tính. */
function FallbackChecks({ checks }: { checks: readonly CompletionCheck[] }) {
  return (
    <section aria-label="Điều kiện hoàn tất" className="space-y-1">
      <h3 className="text-ink-primary font-semibold">{R.heading.COMPLETION}</h3>
      <p className="text-ink-tertiary text-xs">{R.estimateNote}</p>
      <ul className="space-y-1">
        {checks.map((check) => (
          <CheckRow key={check.key} met={check.met}>
            {check.label}
            {check.detail ? <span className="text-ink-tertiary"> — {check.detail}</span> : null}
          </CheckRow>
        ))}
      </ul>
    </section>
  );
}

/** Chi tiết của một điều kiện chặn — chỉ từ dữ kiện BE gửi kèm, không tự tính. */
function blockerDetail(code: string, readiness: Readiness): string | undefined {
  if (code === "RETURN_WINDOW_OPEN" && readiness.returnWindowEndsAt) {
    return R.detail.windowEndsAt(dayOf(readiness.returnWindowEndsAt), readiness.returnWindowDays);
  }
  if (code === "SHIPMENT_UNINVOICED" && readiness.uninvoicedShipmentIds.length > 0) {
    return R.detail.uninvoiced(readiness.uninvoicedShipmentIds.length);
  }
  if (code === "COMPLETION_HELD") return R.detail.held;
  return undefined;
}

/**
 * Khối điều kiện của BE (WF-05 BO-02, F-1): đúng các điều kiện BE còn chặn, các mốc BE tính, và dòng thông tin Q-16
 * (điều chỉnh trả hàng chưa phát hành không chặn đóng). BO không tính thêm, không bớt.
 */
function ReadinessSection({
  readiness,
  status,
  orderId,
}: {
  readiness: Readiness;
  status: string;
  orderId: string;
}) {
  // Audit r3 LM-2 / BE-62: phần phí còn lại chưa có hoá đơn → Kế toán lập ngay tại đây (BE tự đo lại phần còn thiếu; câu trả
  // lời có thể là hoá đơn mới, hay bản giảm của hoá đơn phần phí đã phát hành — mở đúng hoá đơn BE trả)
  const canDrawUp = useCan(EINVOICE_PERMISSIONS.create);
  const [drawingFor, setDrawingFor] = useState<string | null>(null);
  // BE-45 (settlement 9e98660b): REFUND_CLOSE còn là nhánh đóng của đơn RETURNED / PARTIALLY_FULFILLED mà hãng chở hàng
  // về hoặc làm thất lạc — đơn đó đóng khi không còn gì phải hoàn, không phải "sau hoàn tiền"
  const carrierEnded =
    readiness.branch === "REFUND_CLOSE" &&
    (status === "Returned" || status === "Partially Fulfilled");
  const heading = carrierEnded
    ? R.headingCarrierEnded
    : readiness.branch === "COMPLETION" || readiness.branch === "REFUND_CLOSE"
      ? R.heading[readiness.branch]
      : R.section;
  // Nhánh NONE (đơn đã hoàn tất, BE `SettlementReadiness` waitsAs COMPLETED) vẫn có thể còn điều kiện chặn đóng
  // (OWING / OPEN_RETURN / COMPLETION_HELD — audit r2 M-4 / money L-2): hiện chúng, và không hứa ngày tự đóng khi còn chặn
  const waiting = readiness.branch !== "NONE" || readiness.blockers.length > 0;
  const blockedAtRest = readiness.branch === "NONE" && readiness.blockers.length > 0;
  return (
    <section aria-label="Điều kiện hoàn tất" className="space-y-1">
      <h3 className="text-ink-primary font-semibold">{heading}</h3>
      {waiting && (
        <ul className="space-y-1">
          {readiness.blockers.length === 0 ? (
            <CheckRow met>{R.none}</CheckRow>
          ) : (
            readiness.blockers.map((blocker) => {
              const detail = blockerDetail(blocker.code, readiness);
              return (
                <CheckRow key={blocker.code} met={false}>
                  {blocker.known ? R.blockers[blocker.code] : R.unknownBlocker(blocker.code)}
                  {detail ? <span className="text-ink-tertiary"> — {detail}</span> : null}
                  {blocker.code === "SHIPPING_FEE_UNINVOICED" && canDrawUp && (
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      className="ml-2"
                      onClick={() => setDrawingFor(orderId)}
                    >
                      {R.drawUpFeeRest}
                    </Button>
                  )}
                </CheckRow>
              );
            })
          )}
        </ul>
      )}
      {readiness.completesAt && (
        <p className="text-ink-secondary">{R.completesAt(dayOf(readiness.completesAt))}</p>
      )}
      {readiness.closesAt && !blockedAtRest && (
        <p className="text-ink-secondary">{R.closesAt(dayOf(readiness.closesAt))}</p>
      )}
      {readiness.returnAdjustmentUnissued && (
        <p className="text-ink-secondary flex gap-1.5">
          <Info className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {R.returnAdjustmentUnissued}
        </p>
      )}
      {readiness.deliveryReductionUnissued && (
        <p className="text-ink-secondary flex gap-1.5">
          <Info className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {R.deliveryReductionUnissued}
        </p>
      )}
      {readiness.failedDeliveryUnreducedShipmentIds.length > 0 && (
        <p className="text-ink-secondary flex gap-1.5">
          <Info className="text-ink-tertiary mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {R.failedDeliveryUnreduced(readiness.failedDeliveryUnreducedShipmentIds.length)}
        </p>
      )}
      <DrawUpDialog orderId={drawingFor} onClose={() => setDrawingFor(null)} />
    </section>
  );
}
