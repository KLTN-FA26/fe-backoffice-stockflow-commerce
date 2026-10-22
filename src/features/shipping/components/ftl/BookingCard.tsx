"use client";

import { Ban, CalendarCheck, Play, Pencil } from "lucide-react";

import { UI_LABELS } from "@/constants";
import { formatDateTime } from "@/lib/format/date";
import { hasLoadAction } from "@/features/shipping/lifecycle";
import { Alert } from "@/components/shared/Alert";
import { StatusDot } from "@/components/shared/StatusDot";
import { Button } from "@/components/ui/button";

import { InfoItem } from "../primitives";

import type { AllowedLoadAction } from "@/features/shipping/lifecycle";
import type { Load } from "@/features/shipping/types";

const B = UI_LABELS.shipping.ftl.booking;
const F = UI_LABELS.shipping.field;
const PRIMARY =
  "bg-brand text-ink-inverse hover:bg-brand-hover hover:text-ink-inverse rounded-[var(--r-sm)]";

export type BookingDialogKind = "book" | "cancelBooking" | "startLoading";

function hint(load: Load): string {
  if (load.status === "PLANNED") return B.hintPlanned;
  if (load.status === "VEHICLE_BOOKED") return B.hintBooked;
  return B.hintLocked;
}

/**
 * Đặt xe của một xe trong kế hoạch (docs 09 §4.2 bước 5): hãng, biển số, tài xế đã đặt ở ngoài hệ thống,
 * và các bước PLANNED → VEHICLE_BOOKED → LOADING. Nút gate theo `allowedLoadActions` (quyền + trạng thái);
 * sau khi bắt đầu xếp hàng thẻ chỉ còn để xem. Backend phải re-check (BR-14).
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
  const booked = load.status !== "PLANNED" && load.status !== "CANCELLED";
  return (
    <section className="border-border-default bg-bg-surface rounded-[var(--card-radius)] border p-[var(--card-pad)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-ink-primary text-[0.9375rem] font-semibold">{B.title}</h2>
        <StatusDot domain="shipment" status={load.status} size="md" withIcon />
      </div>
      <p className="text-ink-secondary mb-3 text-[0.8125rem]">{hint(load)}</p>
      {load.status === "PLANNED" && load.bookingCancelReason && (
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
          value={
            load.carrierName ? `${load.carrierCode ?? ""} ${load.carrierName}`.trim() : B.notBooked
          }
        />
        <InfoItem label={F.vehiclePlate} value={load.vehiclePlate ?? "—"} mono />
        <InfoItem label={F.driverName} value={load.driverName ?? "—"} />
        <InfoItem label={F.driverPhone} value={load.driverPhone ?? "—"} mono />
        {booked && load.bookedAt && (
          <InfoItem label={B.bookedAt} value={formatDateTime(load.bookedAt)} />
        )}
      </div>
      {(book || cancelBooking || start) && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {book && (
            <Button
              type="button"
              size="sm"
              variant={load.status === "PLANNED" ? "default" : "outline"}
              className={load.status === "PLANNED" ? PRIMARY : undefined}
              onClick={() => onOpen("book")}
            >
              {load.status === "PLANNED" ? (
                <CalendarCheck className="size-3.5" />
              ) : (
                <Pencil className="size-3.5" />
              )}{" "}
              {load.status === "PLANNED" ? B.book : B.rebook}
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
