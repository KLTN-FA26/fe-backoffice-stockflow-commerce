"use client";

import { CUSTOMER_LEGAL_PROFILE_PERMISSIONS, ORDER_PERMISSIONS } from "@/constants";
import { PAYMENT_LABELS } from "@/constants/labels-payment";
import { useCan } from "@/lib/auth/components/Can";

import { useRefundPayee } from "../refund-payee";

const L = PAYMENT_LABELS.recordRefundDialog;

/**
 * Người nhận tiền hoàn (BO-UX-41): tên khách, MST và tài khoản ngân hàng trong thông tin pháp lý — chỉ đọc, chọn chép
 * được. Thiếu quyền đọc đơn thì không hiện; không có tài khoản thì nói rõ, không đoán.
 */
export function RefundPayee({ orderId }: { orderId: string }) {
  const canReadOrder = useCan(ORDER_PERMISSIONS.read);
  const canReadProfile = useCan(CUSTOMER_LEGAL_PROFILE_PERMISSIONS.read);
  const payee = useRefundPayee(orderId, canReadOrder, canReadProfile);
  if (!canReadOrder || !payee.data) return null;
  const { customerName, taxCode, bankAccount } = payee.data;
  return (
    <dl
      aria-label={L.payee}
      className="border-border-default bg-bg-subtle grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]"
    >
      <dt className="text-ink-secondary">{L.customer}</dt>
      <dd className="text-ink-primary">
        {customerName ?? "—"}
        {taxCode && (
          <span className="text-ink-secondary ml-1.5 font-mono text-xs">MST {taxCode}</span>
        )}
      </dd>
      <dt className="text-ink-secondary">{L.bankAccount}</dt>
      <dd className="text-ink-primary select-all">
        {bankAccount ? (
          <>
            <span className="font-mono tabular-nums">{bankAccount.accountNumber}</span> ·{" "}
            {bankAccount.bankName} · {bankAccount.accountHolder}
          </>
        ) : (
          <span className="text-ink-secondary">{L.noBankAccount}</span>
        )}
      </dd>
    </dl>
  );
}
