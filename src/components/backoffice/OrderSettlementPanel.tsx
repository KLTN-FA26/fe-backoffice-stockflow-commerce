"use client";

import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";

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
import { useCan } from "@/lib/auth/components/Can";
import { closingDate, completionChecks } from "@/lib/domain/order-completion";
import { formatMoney } from "@/lib/format";
import { formatDate } from "@/lib/format/date";
import { useEInvoices, invoiceReference } from "@/features/einvoice";
import { useOrderInstallments, useOrderRefund } from "@/features/payment";
import { Card } from "@/components/shared/Card";
import { StatusDot } from "@/components/shared/StatusDot";

import type { OrderSettlementSlotProps } from "@/features/order";

const MONO = "font-mono tabular-nums";
const ROW = "flex flex-wrap items-center justify-between gap-x-4 gap-y-1";

/** Lần giao có hoá đơn gốc / thay thế đã phát hành (docs 21 BR-01). */
const invoicedShipments = (
  rows: readonly { status: string; type: string; shipmentId?: string | null }[],
) =>
  rows
    .filter((row) => row.status === "ISSUED" && row.type !== "ADJUSTMENT" && row.shipmentId)
    .map((row) => row.shipmentId as string);

/**
 * Thanh toán, hoá đơn & hoàn tất của một đơn (WF-05 BO-10): các đợt của hợp đồng (docs 15 §5.2), hoá
 * đơn điện tử theo lần giao (docs 21), hoàn tiền (docs 15 §4.5) và — với đơn đã giao — các điều kiện
 * tự hoàn tất của BE (docs 17 §4.6 bước 21; `lib/domain/order-completion`). Mỗi phần chỉ hiện khi có quyền.
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
  const checks =
    props.status === "Delivered" || props.status === "Return Requested"
      ? completionChecks({
          status: props.status,
          deliveredAt: props.deliveredAt,
          completedAt: props.completedAt,
          outstanding: plan ? plan.outstanding : null,
          deliveredShipmentIds: props.deliveredShipmentIds,
          invoicedShipmentIds: invoicedShipments(rows),
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
              className="text-accent hover:underline"
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
              className="text-accent hover:underline"
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
                    className={`text-accent hover:underline ${MONO}`}
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

      {canRefunds && refund.data && refund.data.refundable > 0 && (
        <section aria-label="Hoàn tiền" className={ROW}>
          <h3 className="text-ink-primary font-semibold">Hoàn tiền</h3>
          <span className="text-ink-secondary">
            Đã hoàn{" "}
            <span className={MONO}>{formatMoney(refund.data.refunded, refund.data.currency)}</span>{" "}
            · còn{" "}
            <span className={MONO}>{formatMoney(refund.data.remaining, refund.data.currency)}</span>
          </span>
          <Link
            className="text-accent hover:underline"
            href={PAYMENT_ROUTES.refunds.ofOrder(props.orderId)}
          >
            Xem
          </Link>
        </section>
      )}

      {checks.length > 0 && (
        <section aria-label="Điều kiện hoàn tất" className="space-y-1">
          <h3 className="text-ink-primary font-semibold">Điều kiện tự hoàn tất (00:30 mỗi đêm)</h3>
          <ul className="space-y-1">
            {checks.map((check) => (
              <li key={check.key} data-met={check.met} className="flex gap-2">
                {check.met ? (
                  <CheckCircle2
                    aria-label="Đạt"
                    className="text-dot-positive mt-0.5 size-3.5 shrink-0"
                  />
                ) : (
                  <Circle
                    aria-label="Chưa đạt"
                    className="text-ink-tertiary mt-0.5 size-3.5 shrink-0"
                  />
                )}
                <span>
                  {check.label}
                  {check.detail ? (
                    <span className="text-ink-tertiary"> — {check.detail}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {props.status === "Completed" && props.completedAt && (
        <p className="text-ink-secondary">
          Đơn đã hoàn tất; tự đóng ngày {formatDate(closingDate(props.completedAt).toISOString())}{" "}
          nếu không còn nợ (docs 17 §4.6 bước 22).
        </p>
      )}
    </Card>
  );
}
