"use client";

import {
  EINVOICE_EMAIL_MISSING_NOTICE,
  EINVOICE_RESEND_EMAIL_PERMISSION,
} from "@/constants/einvoice";
import { useCan } from "@/lib/auth/components/Can";
import { ResendEmailButton } from "@/features/einvoice";

import type { Notification } from "@/features/notification";

/**
 * Thông báo "hoá đơn đã phát hành nhưng chưa gửi được thư" của Sale (BE `EInvoiceIssuedNotificationListener`,
 * `EINVOICE_BUYER_EMAIL_MISSING`, `sourceType` EINVOICE, `sourceId` = mã hoá đơn; audit r2 einvoice M-1): Sale không có
 * quyền xem hoá đơn, nên nút gửi lại nằm ngay trên thông báo — sau khi Sale ghi e-mail vào hồ sơ pháp lý của khách (link
 * của thông báo mở hồ sơ khách).
 */
function EInvoiceEmailMissingAction({ einvoiceId }: { einvoiceId: string }) {
  const canResend = useCan(EINVOICE_RESEND_EMAIL_PERMISSION);
  if (!canResend) return null;
  return (
    <div className="px-3 pb-3">
      <ResendEmailButton einvoiceId={einvoiceId} size="xs" confirm={false} />
    </div>
  );
}

/** Thao tác gắn trên một thông báo của hộp thư BO; thông báo khác → không có. */
export function notificationItemAction(item: Notification) {
  if (
    item.category === EINVOICE_EMAIL_MISSING_NOTICE.category &&
    item.sourceType === EINVOICE_EMAIL_MISSING_NOTICE.sourceType &&
    item.sourceId
  )
    return <EInvoiceEmailMissingAction einvoiceId={item.sourceId} />;
  return null;
}
