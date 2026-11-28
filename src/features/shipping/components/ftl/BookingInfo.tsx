"use client";

import { LOAD_STATUS, UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { isApiBookedLoad } from "@/features/shipping/ftl-selectors";

import { formatPhone } from "../../format-phone";
import { InfoItem } from "../primitives";

import type { Load } from "@/features/shipping/types";

const B = UI_LABELS.shipping.ftl.booking;
const F = UI_LABELS.shipping.field;
const CONNECTION = UI_LABELS.shipping.waybill.carriers.connectionType;

/** "Cách đặt xe": hãng tích hợp API là "Đặt xe tự động qua <hãng>"; hãng khác theo kiểu kết nối (không còn nhãn kỹ thuật "Tích hợp API đặt xe"). */
function bookingWay(load: Load): string | null {
  if (!load.carrierConnectionType) return null;
  return isApiBookedLoad(load) && load.carrierName
    ? B.automaticVia(load.carrierName)
    : CONNECTION[load.carrierConnectionType];
}

/**
 * Thông tin đặt xe của chuyến: hãng (tên, mã ở chú thích), biển số, tài xế, SĐT, cách đặt xe, lúc đặt. Hãng đặt xe qua API:
 * tài xế / SĐT "Chờ hãng cập nhật" (về qua webhook), biển số "Nhập khi ký bàn giao" (hãng không gửi — docs 09 §4.2 bước 6).
 */
export function BookingInfo({ load }: { load: Load }) {
  const booked = load.status !== LOAD_STATUS.PLANNED && load.status !== LOAD_STATUS.CANCELLED;
  const waitCarrier = isApiBookedLoad(load) && booked;
  const way = bookingWay(load);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <InfoItem
        label={F.carrier}
        // Tên hãng; mã chỉ ở chú thích khi rê chuột (R3) — không còn "AHAMOVE Ahamove"
        value={
          load.carrierName ? (
            <span title={load.carrierCode ?? undefined}>{load.carrierName}</span>
          ) : (
            B.notBooked
          )
        }
      />
      <InfoItem
        label={F.vehiclePlate}
        value={
          load.vehiclePlate ? (
            <span>
              <span className="font-mono">{load.vehiclePlate}</span>
              <span className="text-ink-tertiary block text-xs">
                {load.status === LOAD_STATUS.DISPATCHED
                  ? B.plateOnSignedManifest
                  : waitCarrier
                    ? B.plateFromCarrier
                  : B.plateEnteredManually}
              </span>
            </span>
          ) : waitCarrier ? (
            B.plateAtHandover
          ) : (
            "—"
          )
        }
      />
      <InfoItem
        label={F.driverName}
        value={load.driverName ?? (waitCarrier ? B.waitCarrier : "—")}
      />
      <InfoItem
        label={F.driverPhone}
        value={load.driverPhone ? formatPhone(load.driverPhone) : waitCarrier ? B.waitCarrier : "—"}
      />
      {way && <InfoItem label={B.connection} value={way} />}
      {booked && load.bookedAt && (
        <>
          <InfoItem label={B.bookedAt} value={formatDateTime(load.bookedAt)} />
          <InfoItem label={B.bookedBy} value={load.bookedByName ?? "—"} />
        </>
      )}
    </div>
  );
}
