import { CARRIER_CONNECTION_TYPE, SHIPPING_ERROR_MESSAGES, UI_LABELS } from "@/constants";
import { carrierRefusalWords } from "@/features/shipping/errors";
import { formatDateTime } from "@/lib/format/date";
import { Alert } from "@/components/shared/Alert";

import { MONO } from "../primitives";

import type { Load } from "@/features/shipping/types";

const N = UI_LABELS.shipping.waybill.apiBooking.notice;

/**
 * Đơn của chuyến ở hãng đặt xe qua API (BE `carrierBooking`, docs 09 BR-29): trạng thái, mã đơn ở hãng (= mã vận đơn),
 * liên kết theo dõi (dữ liệu mạng: chỉ mở http / https) và lỗi gần nhất. Hãng không huỷ được đơn (CANCEL_FAILED), từ chối
 * (FAILED) hoặc chưa rõ đã tạo đơn chưa (UNCONFIRMED: kiểm trên cổng hãng rồi huỷ đặt) → cảnh báo.
 */
export function CarrierOrderNotice({ load }: { load: Load }) {
  const booking = load.carrierBooking;
  // Đặt lại với hãng khác: đơn cũ vẫn còn trong lịch sử nhưng không còn là đơn hiện tại của chuyến.
  if (!booking || load.carrierConnectionType !== CARRIER_CONNECTION_TYPE.API_BOOKING) return null;
  const problem =
    booking.status === "FAILED" ||
    booking.status === "UNCONFIRMED" ||
    booking.status === "CANCEL_FAILED";
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
        // BE đã dịch lỗi hãng biết mã (BE #481); lỗi còn "406 CODE: …" thô thì bỏ phần mã, chỉ còn mã thì câu chung (R7)
        <p className="mt-1">
          {N.lastError}:{" "}
          {carrierRefusalWords(booking.lastError) || SHIPPING_ERROR_MESSAGES.CARRIER_BOOKING_FAILED}
        </p>
      )}
    </Alert>
  );
}
