"use client";

import Link from "next/link";

import { ADMIN_ROUTES, SALES_CONTRACT_PERMISSIONS, UI_LABELS } from "@/constants";
import { PAYMENT_INSTALLMENT_PERMISSIONS, PAYMENT_ROUTES } from "@/constants/payment";
import { useCan } from "@/lib/auth/components/Can";

const B = UI_LABELS.shipping.waybill.blocked;

/**
 * Đường dẫn từ lý do chặn bàn giao tới màn xử lý nó (theo `reasonCode` của BE): chưa thu đợt trước khi giao → các đợt
 * thanh toán của đơn (cần `payment-installments:READ`, như màn đó); chưa tới cửa sổ giao → lịch giao ở chi tiết đơn, nơi
 * Sale dời cửa sổ (cần `sales-contracts:READ` để thấy lịch và `sales-contracts:UPDATE` để dời — docs 17 BR-28). Thiếu quyền
 * thì không hiện liên kết. UI-only — Backend phải re-check.
 */
export function HandoverReasonLink({
  orderId,
  reasonCode,
}: {
  orderId: string;
  reasonCode: string | null | undefined;
}) {
  const canCollect = useCan(PAYMENT_INSTALLMENT_PERMISSIONS.read);
  const canReadSchedule = useCan(SALES_CONTRACT_PERMISSIONS.read);
  const canMoveWindow = useCan(SALES_CONTRACT_PERMISSIONS.update);

  if (reasonCode === "ORDER_BALANCE_NOT_PAID" && canCollect) {
    return (
      <Link href={PAYMENT_ROUTES.installments.ofOrder(orderId)} className="ml-1 underline">
        {B.linkCollectPayment}
      </Link>
    );
  }
  if (reasonCode === "DELIVERY_BATCH_WINDOW_NOT_OPEN" && canReadSchedule && canMoveWindow) {
    return (
      <Link href={ADMIN_ROUTES.orders.detail(orderId)} className="ml-1 underline">
        {B.linkMoveWindow}
      </Link>
    );
  }
  return null;
}
