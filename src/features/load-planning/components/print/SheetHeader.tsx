import { LOAD_PLAN_PRINT_LABELS } from "@/constants";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";

import { formatKg } from "../../lib/print-labels";
import { formatNominalCm } from "../../lib/dims";
import { EMPTY, Field } from "./primitives";

import type { LoadBooking } from "../../print-booking";
import type { PrintSheet } from "../../lib/print-sheet";

const H = LOAD_PLAN_PRINT_LABELS.header;

const carrierOf = (booking: LoadBooking): string =>
  [booking.carrierCode, booking.carrierName].filter(Boolean).join(" ") || EMPTY;

const driverOf = (booking: LoadBooking): string =>
  [booking.driverName, booking.driverPhone].filter(Boolean).join(" · ") || EMPTY;

/**
 * Đầu phiếu: mã kế hoạch, xe (loại, số thứ tự, lòng xe, tải trọng, mức lấp đầy), thông tin đặt xe nếu xe đã thành chuyến
 * có hãng / biển số / tài xế, ngày in. Chuyến chưa đặt xe thì các ô để trống cho người xếp hàng ghi tay.
 */
export function SheetHeader({
  planCode,
  sheet,
  booking,
  printedAt,
}: {
  planCode: string;
  sheet: PrintSheet;
  booking: LoadBooking | null | undefined;
  printedAt: string;
}) {
  const { vehicle, layout } = sheet;
  const booked = !!booking && !!(booking.carrierName || booking.vehiclePlate || booking.driverName);
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="text-ink-primary text-xl font-semibold">
          {LOAD_PLAN_PRINT_LABELS.documentTitle}
        </h2>
        <p className="text-ink-secondary font-mono text-[0.8125rem]">
          {H.plan} {planCode}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3 print:grid-cols-3">
        <Field label={H.vehicleLabel}>{H.vehicle(layout.seq, layout.code)}</Field>
        <Field label={H.innerDims}>{formatNominalCm(layout.innerMm)} cm</Field>
        <Field label={H.payload}>{formatNumber(layout.maxPayloadKg)} kg</Field>
        <Field label={H.volumeFill}>{formatPercent(vehicle.volumeFillPct / 100, 1)}</Field>
        <Field label={H.weightFill}>
          {formatPercent(vehicle.weightFillPct / 100, 1)} ({formatKg(sheet.totalWeightKg)} kg)
        </Field>
        <Field label={H.parcels}>{formatNumber(layout.boxes.length)}</Field>
        <Field label={H.carrier}>{booked ? carrierOf(booking) : EMPTY}</Field>
        <Field label={H.plate}>{booking?.vehiclePlate || EMPTY}</Field>
        <Field label={H.driver}>{booked ? driverOf(booking) : EMPTY}</Field>
        <Field label={H.printedAt}>{formatDate(printedAt)}</Field>
        {vehicle.load && <Field label={H.dispatchLoad}>{vehicle.load.code}</Field>}
        {!booked && <Field label={H.booking}>{H.notBooked}</Field>}
      </dl>
    </header>
  );
}
