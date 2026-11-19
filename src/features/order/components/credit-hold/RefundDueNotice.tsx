"use client";

import Link from "next/link";

import { PAYMENT_REFUND_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { usePermissionChecker } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { Notice } from "@/components/shared/Notice";

import { useOrderRefundDue } from "../../refund-lookup";

/**
 * Sau khi từ chối tín dụng: số phải hoàn của đơn (`GET /refunds/orders/{orderId}`, plan WF-02 C5) + link màn
 * hoàn tiền. Thiếu quyền `payment-refunds:READ` → chỉ link.
 */
export function RefundDueNotice({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber?: string;
}) {
  const can = usePermissionChecker();
  const canRead = can(PAYMENT_REFUND_PERMISSIONS.read);
  const refund = useOrderRefundDue(orderId, canRead);
  const link = (
    <Link href={PAYMENT_ROUTES.refunds.ofOrder(orderId)} className="text-accent hover:underline">
      Mở màn hoàn tiền
    </Link>
  );
  const prefix = orderNumber ? `Đơn ${orderNumber} đã huỷ (CREDIT_REJECTED). ` : "";
  if (!canRead || refund.isError)
    return (
      <Notice tone="info">
        {prefix}Xem số phải hoàn ở màn hoàn tiền. {link}
      </Notice>
    );
  if (refund.isPending) return <Notice tone="info">{prefix}Đang tải số phải hoàn…</Notice>;
  return (
    <Notice tone={refund.data.remaining > 0 ? "warning" : "info"}>
      {prefix}Phải hoàn:{" "}
      <strong className="font-mono tabular-nums">
        {formatMoney(refund.data.remaining, refund.data.currency)}
      </strong>
      . {link}
    </Notice>
  );
}
