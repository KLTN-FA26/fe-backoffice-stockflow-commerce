import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const N = UI_LABELS.shipping.waybill.apiBooking.notice;

/**
 * Đơn của chuyến ở hãng đặt xe qua API (BE `carrierBooking`, docs 09 BR-29): trạng thái, mã đơn ở hãng (= mã vận đơn),
 * liên kết theo dõi (dữ liệu mạng: chỉ mở http / https) và lỗi gần nhất. Hãng không huỷ được đơn (CANCEL_FAILED) hoặc từ chối (FAILED) → cảnh báo.
 */
export function CarrierOrderNotice({ load }: { load: Load }) {
  const booking = load.carrierBooking;
  if (!booking) return null;
  const problem = booking.status === "FAILED" || booking.status === "CANCEL_FAILED";
  return (
    <Alert tone={problem ? "warning" : "info"} title={N.title}>
      <span>{N.status[booking.status]}</span>
      {booking.carrierOrderId && (
        <span>
          {" · "}
          {N.carrierOrder} <span className={MONO}>{booking.carrierOrderId}</span>
        </span>
      )}
      {booking.bookedAt && <span>{` · ${formatDateTime(booking.bookedAt)}`}</span>}
      {booking.trackingLink && /^https?:\/\//i.test(booking.trackingLink) && (
        <span>
          {" · "}
          <a
            href={booking.trackingLink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {N.tracking}
          </a>
        </span>
      )}
      {booking.lastError && (
        <p className="mt-1">
          {N.lastError}: {booking.lastError}
        </p>
      )}
    </Alert>
  );
}
