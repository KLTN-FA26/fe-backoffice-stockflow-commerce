"use client";

import Link from "next/link";

import { UI_LABELS } from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan } from "@/lib/auth";

/**
 * Lối sang các đợt thanh toán của đơn trong dải "phải thu trước khi giao" (S15-3): người xem được đợt thanh toán thấy
 * link; ai lập phiếu thu (Kế toán) đã nói trong câu. UI-only — Backend phải re-check (payment-installments:READ).
 */
export function PaymentDueLink({ orderId }: { orderId: string }) {
  const canRead = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  if (!canRead) return null;
  return (
    <>
      {" "}
      <Link
        href={PAYMENT_ROUTES.installments.ofOrder(orderId)}
        className="text-accent-text font-medium whitespace-nowrap hover:underline"
      >
        {UI_LABELS.cartonCheck.notice.paymentLink}
      </Link>
    </>
  );
}
