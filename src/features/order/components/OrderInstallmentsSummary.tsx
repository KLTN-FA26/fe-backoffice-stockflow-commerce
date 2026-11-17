"use client";

import { ORDER_INSTALLMENTS_LABELS } from "@/constants";
import { INSTALLMENT_STATUS_BY_API, PAYMENT_INSTALLMENT_PERMISSIONS } from "@/constants/payment";
import { formatMoney } from "@/lib/format";
import { StatusDot } from "@/components/shared/StatusDot";

import { useOrderInstallmentsSummary } from "../queries";

import type { PermissionCode } from "@/lib/auth";

const L = ORDER_INSTALLMENTS_LABELS;

/**
 * Các đợt thanh toán của đơn trong khối "Thanh toán" (docs 15 §5.2): số đợt, đã thu / tổng, trạng thái từng đợt
 * (nhãn Việt qua `StatusDot`). Chỉ gọi API và chỉ hiện khi có `payment-installments:READ`; chưa tải xong, lỗi
 * (vd 404 đơn chưa có hợp đồng ký) hoặc không có đợt thì không hiện gì — không dòng "—". Phương thức: đợt không mang
 * trường này nên không hiện. UI-only — Backend phải re-check.
 */
export function OrderInstallmentsSummary({
  orderId,
  can,
}: {
  orderId: string;
  can: (code: PermissionCode) => boolean;
}) {
  const allowed = can(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const { data } = useOrderInstallmentsSummary(orderId, { enabled: allowed });
  if (!allowed || !data || data.installments.length === 0) return null;
  return (
    <>
      <dt className="text-ink-secondary">{L.count}</dt>
      <dd className="text-ink-primary text-right">{L.countValue(data.installments.length)}</dd>
      <dt className="text-ink-secondary">{L.collected}</dt>
      <dd className="text-ink-primary text-right font-mono tabular-nums">
        {formatMoney(data.paid, data.currency)} / {formatMoney(data.total, data.currency)}
      </dd>
      <dt className="text-ink-secondary col-span-2 mt-1">{L.list}</dt>
      <dd className="col-span-2">
        <ul className="space-y-1">
          {data.installments.map((installment) => (
            <li key={installment.installmentId} className="flex items-center justify-between gap-3">
              <span className="text-ink-primary min-w-0 truncate">
                {installment.seq}. {installment.name}
                <span className="text-ink-secondary ml-1.5 font-mono text-xs tabular-nums">
                  {formatMoney(installment.paidAmount, data.currency)} /{" "}
                  {formatMoney(installment.amount, data.currency)}
                </span>
              </span>
              <StatusDot domain="payment" status={INSTALLMENT_STATUS_BY_API[installment.status]} />
            </li>
          ))}
        </ul>
      </dd>
    </>
  );
}
