"use client";

import Link from "next/link";

import { ORDER_INSTALLMENTS_LABELS } from "@/constants";
import {
  INSTALLMENT_STATUS_BY_API,
  ORDER_PAYMENT_STATUS_BY_API,
  PAYMENT_INSTALLMENT_PERMISSIONS,
  PAYMENT_ROUTES,
} from "@/constants/payment";
import { formatMoney } from "@/lib/format";
import { formatDate, toLocalIsoDate } from "@/lib/format/date";
import { StatusDot } from "@/components/shared/StatusDot";

import { useOrderInstallmentsSummary } from "../queries";
import { installmentDue } from "../selectors";

import type { ReactNode } from "react";
import type { PermissionCode } from "@/lib/auth";
import type { OrderInstallmentsSummary as Summary } from "../installments-summary-api";

const L = ORDER_INSTALLMENTS_LABELS;
const MONEY = "text-ink-primary text-right font-mono tabular-nums";

function PaymentStatus({ status }: { status: NonNullable<Summary["paymentStatus"]> }) {
  if (status === "UNKNOWN") return <span className="text-ink-secondary">{L.unknownStatus}</span>;
  return <StatusDot domain="payment" status={ORDER_PAYMENT_STATUS_BY_API[status]} />;
}

function Row({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="text-ink-secondary">{label}</dt>
      <dd className={className ?? "text-ink-primary text-right"}>{children}</dd>
    </>
  );
}

/**
 * Tiến độ thu tiền của đơn trong khối "Thanh toán" (docs 15 §5.2; BE `GET /installments/orders/{id}`): tình trạng thanh
 * toán, đã thu / tổng, còn phải thu, phải thu trước khi xuất (chỉ khi > 0), rồi từng đợt (nhãn Việt qua `StatusDot`).
 * Đơn đã huỷ mà mọi đợt đã huỷ chỉ hiện "Đã thanh toán {paid}". Chỉ gọi API và chỉ hiện khi có `payment-installments:READ`; chưa tải xong, lỗi (vd 404 đơn chưa có hợp đồng ký) hoặc
 * không có đợt thì không hiện gì — không dòng "—". Số BE vắng không hiện, không thành 0. UI-only — Backend phải re-check.
 */
export function OrderInstallmentsSummary({
  orderId,
  can,
  cancelled = false,
}: {
  orderId: string;
  can: (code: PermissionCode) => boolean;
  /** Đơn ở trạng thái Cancelled (WF-02 mục 26). */
  cancelled?: boolean;
}) {
  const allowed = can(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const { data } = useOrderInstallmentsSummary(orderId, { enabled: allowed });
  if (!allowed || !data || data.installments.length === 0) return null;
  const { currency } = data;
  const today = toLocalIsoDate(new Date().toISOString());
  // BE `paymentStatus` is null only when every installment is cancelled. Then the total and "outstanding" are 0 by
  // construction and mean nothing: show what the customer paid (refund is settled on the refund screen). A cancellation
  // fee still owed keeps a live installment, so `paymentStatus` stays set and "Còn phải thu" stays.
  if (cancelled && !data.paymentStatus)
    return (
      <Row label={L.paidWhenCancelled} className={MONEY}>
        {formatMoney(data.paid, currency)}
      </Row>
    );
  return (
    <>
      {data.paymentStatus && (
        <Row label={L.paymentStatus}>
          <PaymentStatus status={data.paymentStatus} />
        </Row>
      )}
      <Row label={L.collected} className={MONEY}>
        {formatMoney(data.paid, currency)} / {formatMoney(data.total, currency)}
      </Row>
      {data.outstanding != null && (
        <Row label={L.outstanding} className={MONEY}>
          {formatMoney(data.outstanding, currency)}
        </Row>
      )}
      {data.dueBeforeHandover != null && data.dueBeforeHandover > 0 && (
        <Row label={L.dueBeforeHandover} className={MONEY}>
          {formatMoney(data.dueBeforeHandover, currency)}
        </Row>
      )}
      <Row label={L.count}>{L.countValue(data.installments.length)}</Row>
      <dt className="text-ink-secondary col-span-2 mt-1">{L.list}</dt>
      <dd className="col-span-2">
        <ul className="space-y-1">
          {data.installments.map((installment) => {
            const due = installmentDue(installment, today);
            return (
              <li
                key={installment.installmentId}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-ink-primary min-w-0">
                  <span className="block truncate">
                    {installment.seq}. {installment.name}
                  </span>
                  <span className="text-ink-secondary block font-mono text-xs tabular-nums">
                    {formatMoney(installment.paidAmount, currency)} /{" "}
                    {formatMoney(installment.amount, currency)}
                    {due.dueDate && <> · {L.dueOn(formatDate(due.dueDate))}</>}
                  </span>
                  {due.daysOverdue > 0 && (
                    <span className="text-danger block text-xs font-medium">
                      {L.overdueDays(due.daysOverdue)}
                    </span>
                  )}
                </span>
                <StatusDot
                  domain="payment"
                  status={INSTALLMENT_STATUS_BY_API[installment.status]}
                />
              </li>
            );
          })}
        </ul>
        <Link
          href={PAYMENT_ROUTES.installments.ofOrder(orderId)}
          className="text-accent-text mt-1 inline-block text-xs font-medium hover:underline"
        >
          {L.viewAll}
        </Link>
      </dd>
    </>
  );
}
