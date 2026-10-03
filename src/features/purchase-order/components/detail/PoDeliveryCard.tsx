"use client";

import { Send } from "lucide-react";

import { PO_DELIVERY_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format";
import { isDeliveryFailing } from "@/features/purchase-order";
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
  const failed = isDeliveryFailing(po);

  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <h2 className="text-ink-primary mb-3 flex items-center gap-2 text-[0.9375rem] font-semibold">
        <Send className="text-accent size-4" />
        Gửi nhà cung cấp
      </h2>
      {failed && (
        <p
          role="alert"
          className="border-warning/30 bg-warning/10 text-warning mb-3 rounded-[var(--r-sm)] border px-3 py-2 text-[0.8125rem]"
        >
          Lần gửi gần nhất chưa tới được NCC. Kiểm tra lịch sử gửi; người có quyền duyệt có thể khôi
          phục gửi.
        </p>
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
        </div>
      </div>

      <h3 className="text-ink-secondary mt-4 mb-2 text-xs font-semibold">Lịch sử gửi</h3>
      <PoDeliveryTables poId={po.poId} />
    </section>
  );
}
