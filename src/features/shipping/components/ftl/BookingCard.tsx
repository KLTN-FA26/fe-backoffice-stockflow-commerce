"use client";

import { Ban, CalendarCheck, Play, Pencil, UserRound } from "lucide-react";

import { LOAD_STATUS, UI_LABELS } from "@/constants";
import { isApiBookedLoad } from "@/features/shipping/ftl-selectors";
import { formatDateTime } from "@/lib/format/date";
import { hasLoadAction } from "@/features/shipping/lifecycle";
import { Alert } from "@/components/shared/Alert";
import { Button } from "@/components/ui/button";

import { formatPhone } from "../../format-phone";
import { InfoItem } from "../primitives";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";

const B = UI_LABELS.shipping.ftl.booking;
const F = UI_LABELS.shipping.field;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

export type BookingDialogKind = "book" | "cancelBooking" | "startLoading" | "driver";

const CONNECTION = UI_LABELS.shipping.waybill.carriers.connectionType;

/** "Cách đặt xe": hãng tích hợp API là "Đặt xe tự động qua <hãng>"; hãng khác theo kiểu kết nối (không còn nhãn kỹ thuật "Tích hợp API đặt xe"). */
function bookingWay(load: Load): string | null {
  if (!load.carrierConnectionType) return null;
  return isApiBookedLoad(load) && load.carrierName
    ? B.automaticVia(load.carrierName)
    : CONNECTION[load.carrierConnectionType];
}

function hint(load: Load): string {
  if (load.status === LOAD_STATUS.PLANNED) return B.hintPlanned;
  if (load.status === LOAD_STATUS.VEHICLE_BOOKED) return B.hintBooked;
  return B.hintLocked;
}

/**
 * Đặt xe của một xe trong kế hoạch (docs 09 §4.2 bước 5): hãng, biển số, tài xế đã đặt ở ngoài hệ thống,
 * và các bước PLANNED → VEHICLE_BOOKED → LOADING. Nút gate theo `allowedLoadActions` (quyền + trạng thái);
 * sau khi bắt đầu xếp hàng thẻ chỉ còn để xem. Backend phải re-check (BR-14). Trạng thái chuyến đã ở thẻ thông tin đầu
 * trang nên thẻ không lặp lại; MỘT nút chính mỗi bước (S17-5). Hãng đặt xe qua API: tài xế "Chờ hãng cập nhật", biển số
 * nhập khi ký bàn giao (hãng không gửi — docs 09 §4.2 bước 6).
 */
export function BookingCard({
  load,
  actions,
  onOpen,
}: {
  load: Load;
  actions: readonly AllowedLoadAction[];
  onOpen: (dialog: BookingDialogKind) => void;
}) {
  const book = hasLoadAction(actions, "book");
  const cancelBooking = hasLoadAction(actions, "cancelBooking");
  const start = hasLoadAction(actions, "startLoading");
  const driver = hasLoadAction(actions, "recordDriver");
  const planned = load.status === LOAD_STATUS.PLANNED;
  const booked = load.status !== LOAD_STATUS.PLANNED && load.status !== LOAD_STATUS.CANCELLED;
  const waitCarrier = isApiBookedLoad(load) && booked;
  const way = bookingWay(load);
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{B.title}</h2>
      </div>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{hint(load)}</p>
      {planned && load.bookingCancelReason && (
        <Alert tone="warning" className="mb-3">
          {B.lastCancelled}
          {load.bookingCancelledAt &&
            ` ${B.lastCancelledAt} ${formatDateTime(load.bookingCancelledAt)}`}
          : {load.bookingCancelReason}
        </Alert>
      )}
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
          value={load.vehiclePlate ?? (waitCarrier ? B.plateAtHandover : "—")}
          mono={!!load.vehiclePlate}
        />
        <InfoItem
          label={F.driverName}
          value={load.driverName ?? (waitCarrier ? B.waitCarrier : "—")}
        />
        <InfoItem
          label={F.driverPhone}
          value={
            load.driverPhone ? formatPhone(load.driverPhone) : waitCarrier ? B.waitCarrier : "—"
          }
        />
        {way && <InfoItem label={B.connection} value={way} />}
        {booked && load.bookedAt && (
          <InfoItem label={B.bookedAt} value={formatDateTime(load.bookedAt)} />
        )}
      </div>
      {(book || cancelBooking || start || driver) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {book && (
            <Button
              type="button"
              size="sm"
              variant={planned ? "default" : "outline"}
              className={planned ? PRIMARY : undefined}
              disabled={!!book.disabledReason}
              title={book.disabledReason}
              onClick={() => onOpen("book")}
            >
              {planned ? <CalendarCheck className="size-3.5" /> : <Pencil className="size-3.5" />}{" "}
              {planned ? B.book : B.rebook}
            </Button>
          )}
          {driver && (
            <Button type="button" size="sm" variant="outline" onClick={() => onOpen("driver")}>
              <UserRound className="size-3.5" /> {load.driverName ? B.editDriver : B.enterDriver}
            </Button>
          )}
          {cancelBooking && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onOpen("cancelBooking")}
            >
              <Ban className="size-3.5" /> {B.cancel}
            </Button>
          )}
          {start && (
            <Button
              type="button"
              size="sm"
              className={PRIMARY}
              onClick={() => onOpen("startLoading")}
            >
              <Play className="size-3.5" /> {B.start}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
