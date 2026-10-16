"use client";

import { Send } from "lucide-react";

import { PO_DELIVERY_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format";
import {
  deliveryAlert,
  isDeliveryInFlight,
  showsCancellationNotice,
} from "@/features/purchase-order";
import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";

import { InfoRow } from "./InfoRow";
import { PoDeliveryTables } from "./PoDeliveryTables";

import type { PurchaseOrder } from "@/features/purchase-order";

/**
 * Giao tiếp NCC (BE #36): trạng thái gửi (`deliveryStatus`), phản hồi của NCC
 * (`supplierConfirmationStatus`) và 2 bảng lịch sử: lần gửi (`GET …/deliveries`)
 * + quyết định gửi (`GET …/delivery-decisions`).
 * Gửi lỗi thì PO vẫn SENT nhưng `deliveryStatus` = RETRYING/FAILED — phải hiện cho người dùng thấy.
 */
export function PoDeliveryCard({ po }: { po: PurchaseOrder }) {
  const sent = po.deliveryStatus !== PO_DELIVERY_STATUS.NOT_SENT || !!po.sentAt;
  if (!sent) return null;
  const alert = deliveryAlert(po);

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Send className="text-accent size-4" />
        Gửi nhà cung cấp
      </h2>
      {alert && (
        <div role={alert === "recoverable" ? "alert" : "status"} className="mb-3">
          <Alert tone={alert === "recoverable" ? "warning" : "info"}>
            {UI_LABELS.purchaseOrder.deliveryAlert[alert]}
          </Alert>
        </div>
      )}
      {/* Mỗi cột là một danh sách riêng: InfoRow bỏ kẻ ngang ở dòng cuối của TỪNG cột
          (last:border-b-0), nên hai cột luôn kẻ ngang đối xứng. */}
      <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2">
        <div>
          <InfoRow label="Trạng thái gửi">
            <StatusDot domain="po" status={po.deliveryStatus} size="sm" withIcon />
          </InfoRow>
          <InfoRow label="Gửi lúc" value={po.sentAt ? formatDateTime(po.sentAt) : "—"} />
        </div>
        <div>
          <InfoRow label="NCC phản hồi">
            <StatusDot domain="po" status={po.supplierConfirmationStatus} size="sm" withIcon />
          </InfoRow>
          <InfoRow
            label="Phản hồi lúc"
            value={po.supplierRespondedAt ? formatDateTime(po.supplierRespondedAt) : "—"}
          />
          {po.supplierReference && (
            <InfoRow
              label={UI_LABELS.purchaseOrder.supplierReference}
              value={po.supplierReference}
              mono
            />
          )}
          {po.supplierResponseNote && (
            <InfoRow label="Ghi chú NCC" value={po.supplierResponseNote} />
          )}
          {/* BE #36: PO đã gửi rồi mới huỷ → BE gửi thông báo huỷ cho NCC. */}
          {showsCancellationNotice(po) && po.cancellationDeliveryStatus && (
            <InfoRow label={UI_LABELS.purchaseOrder.cancellationNotice}>
              <StatusDot domain="po" status={po.cancellationDeliveryStatus} size="sm" withIcon />
            </InfoRow>
          )}
        </div>
      </div>

      <h3 className="text-ink-secondary mt-4 mb-2 text-xs font-semibold">Lịch sử gửi</h3>
      <PoDeliveryTables poId={po.poId} poll={isDeliveryInFlight(po)} />
    </section>
  );
}
